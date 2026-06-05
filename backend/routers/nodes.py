from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models import Node, InventoryItem, ChangeLog, User, TransferRecord
from schemas import (
    NodeCreate,
    NodeUpdate,
    NodeResponse,
    TreeNode,
    InventorySummary,
    NodeAggregation,
    ChangeLogResponse,
    TransferResponse,
)
from auth import get_current_user, require_role

router = APIRouter(prefix="/api/nodes", tags=["节点管理"])


def build_tree(nodes: list[Node], parent_id: Optional[int] = None) -> list[TreeNode]:
    tree_nodes = []
    for node in nodes:
        if node.parent_id == parent_id:
            tree_node = TreeNode(
                id=node.id,
                name=node.name,
                node_type=node.node_type,
                parent_id=node.parent_id,
                code=node.code,
                description=node.description,
                sort_order=node.sort_order,
                created_at=node.created_at,
                updated_at=node.updated_at,
                children=build_tree(nodes, node.id),
            )
            tree_nodes.append(tree_node)
    tree_nodes.sort(key=lambda x: x.sort_order)
    return tree_nodes


def get_descendant_ids(db: Session, node_id: int) -> list[int]:
    all_ids = [node_id]
    children = db.query(Node).filter(Node.parent_id == node_id).all()
    for child in children:
        all_ids.extend(get_descendant_ids(db, child.id))
    return all_ids


def compute_aggregation(db: Session, node_id: int) -> InventorySummary:
    descendant_ids = get_descendant_ids(db, node_id)
    items = db.query(InventoryItem).filter(InventoryItem.node_id.in_(descendant_ids)).all()
    total_quantity = sum(item.quantity for item in items)
    total_items = len(items)
    out_of_stock_items = sum(1 for item in items if item.quantity == 0)
    low_stock_items = sum(1 for item in items if 0 < item.quantity <= item.min_quantity)
    return InventorySummary(
        total_quantity=total_quantity,
        total_items=total_items,
        out_of_stock_items=out_of_stock_items,
        low_stock_items=low_stock_items,
    )


def build_aggregation_tree(db: Session, node_id: int, depth: int = 0) -> NodeAggregation:
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="节点不存在")
    summary = compute_aggregation(db, node.id)
    recent_logs = (
        db.query(ChangeLog)
        .filter(ChangeLog.node_id == node.id)
        .order_by(ChangeLog.created_at.desc())
        .limit(5)
        .all()
    )
    recent_changes = []
    for log in recent_logs:
        user = db.query(User).filter(User.id == log.user_id).first()
        recent_changes.append(
            ChangeLogResponse(
                id=log.id,
                node_id=log.node_id,
                user_id=log.user_id,
                change_type=log.change_type,
                description=log.description,
                old_value=log.old_value,
                new_value=log.new_value,
                created_at=log.created_at,
                username=user.username if user else None,
            )
        )

    recent_transfer_records = (
        db.query(TransferRecord)
        .filter((TransferRecord.from_node_id == node.id) | (TransferRecord.to_node_id == node.id))
        .order_by(TransferRecord.created_at.desc())
        .limit(5)
        .all()
    )
    recent_transfers = []
    for rec in recent_transfer_records:
        from_node = db.query(Node).filter(Node.id == rec.from_node_id).first()
        to_node = db.query(Node).filter(Node.id == rec.to_node_id).first()
        t_user = db.query(User).filter(User.id == rec.user_id).first()
        recent_transfers.append(
            TransferResponse(
                id=rec.id,
                item_id=rec.item_id,
                sku=rec.sku,
                product_name=rec.product_name,
                from_node_id=rec.from_node_id,
                from_node_name=from_node.name if from_node else "",
                to_node_id=rec.to_node_id,
                to_node_name=to_node.name if to_node else "",
                quantity=rec.quantity,
                remark=rec.remark,
                user_id=rec.user_id,
                username=t_user.username if t_user else None,
                created_at=rec.created_at,
            )
        )

    children = db.query(Node).filter(Node.parent_id == node_id).order_by(Node.sort_order).all()
    child_aggs = [build_aggregation_tree(db, child.id, depth + 1) for child in children]
    return NodeAggregation(
        node_id=node.id,
        node_name=node.name,
        node_type=node.node_type,
        summary=summary,
        recent_changes=recent_changes,
        recent_transfers=recent_transfers,
        children=child_aggs,
    )


@router.get("/tree", response_model=list[TreeNode])
async def get_tree(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    nodes = db.query(Node).order_by(Node.sort_order).all()
    return build_tree(nodes)


@router.get("/aggregation/{node_id}", response_model=NodeAggregation)
async def get_node_aggregation(node_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return build_aggregation_tree(db, node_id)


@router.get("/", response_model=list[NodeResponse])
async def list_nodes(
    parent_id: Optional[int] = None,
    node_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Node)
    if parent_id is not None:
        query = query.filter(Node.parent_id == parent_id)
    if node_type:
        query = query.filter(Node.node_type == node_type)
    return query.order_by(Node.sort_order).all()


@router.get("/{node_id}", response_model=NodeResponse)
async def get_node(node_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="节点不存在")
    return node


@router.post("/", response_model=NodeResponse)
async def create_node(
    node_data: NodeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    existing = db.query(Node).filter(Node.code == node_data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="节点编码已存在")
    if node_data.parent_id:
        parent = db.query(Node).filter(Node.id == node_data.parent_id).first()
        if not parent:
            raise HTTPException(status_code=400, detail="父节点不存在")
    node = Node(**node_data.model_dump())
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


@router.put("/{node_id}", response_model=NodeResponse)
async def update_node(
    node_id: int,
    node_data: NodeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="节点不存在")
    update_data = node_data.model_dump(exclude_unset=True)
    if "code" in update_data and update_data["code"] != node.code:
        existing = db.query(Node).filter(Node.code == update_data["code"]).first()
        if existing:
            raise HTTPException(status_code=400, detail="节点编码已存在")
    if "parent_id" in update_data:
        if update_data["parent_id"] == node_id:
            raise HTTPException(status_code=400, detail="不能将自己设为父节点")
    for key, value in update_data.items():
        setattr(node, key, value)
    db.commit()
    db.refresh(node)
    return node


@router.delete("/{node_id}")
async def delete_node(
    node_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="节点不存在")
    children = db.query(Node).filter(Node.parent_id == node_id).count()
    if children > 0:
        raise HTTPException(status_code=400, detail="该节点下有子节点，无法删除")
    db.delete(node)
    db.commit()
    return {"message": "节点已删除"}
