import csv
import io
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models import InventoryItem, ChangeLog, Node, User, TransferRecord
from schemas import (
    InventoryItemCreate,
    InventoryItemUpdate,
    InventoryItemResponse,
    ChangeLogCreate,
    ChangeLogResponse,
    TransferCreate,
    TransferResponse,
)
from auth import get_current_user, require_role
from routers.nodes import get_descendant_ids

router = APIRouter(prefix="/api/inventory", tags=["库存管理"])


def create_change_log(db: Session, user_id: int, node_id: int, change_type: str, description: str, old_value: str = "", new_value: str = ""):
    log = ChangeLog(
        node_id=node_id,
        user_id=user_id,
        change_type=change_type,
        description=description,
        old_value=old_value,
        new_value=new_value,
    )
    db.add(log)
    db.commit()


@router.get("/items", response_model=list[InventoryItemResponse])
async def list_inventory_items(
    node_id: Optional[int] = None,
    sku: Optional[str] = None,
    low_stock: Optional[bool] = None,
    out_of_stock: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(InventoryItem)
    if node_id is not None:
        descendant_ids = get_descendant_ids(db, node_id)
        query = query.filter(InventoryItem.node_id.in_(descendant_ids))
    if sku:
        query = query.filter(InventoryItem.sku.contains(sku))
    if low_stock:
        query = query.filter(InventoryItem.quantity > 0, InventoryItem.quantity <= InventoryItem.min_quantity)
    if out_of_stock:
        query = query.filter(InventoryItem.quantity == 0)
    return query.order_by(InventoryItem.updated_at.desc()).all()


@router.get("/items/{item_id}", response_model=InventoryItemResponse)
async def get_inventory_item(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="库存条目不存在")
    return item


@router.post("/items", response_model=InventoryItemResponse)
async def create_inventory_item(
    item_data: InventoryItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "staff")),
):
    node = db.query(Node).filter(Node.id == item_data.node_id).first()
    if not node:
        raise HTTPException(status_code=400, detail="所属节点不存在")
    item = InventoryItem(**item_data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    create_change_log(
        db, current_user.id, item.node_id,
        "inventory_add", f"新增库存条目: {item.product_name}",
        "", f"SKU: {item.sku}, 数量: {item.quantity}"
    )
    return item


@router.put("/items/{item_id}", response_model=InventoryItemResponse)
async def update_inventory_item(
    item_id: int,
    item_data: InventoryItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "staff")),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="库存条目不存在")
    update_data = item_data.model_dump(exclude_unset=True)
    old_values = f"SKU: {item.sku}, 数量: {item.quantity}, 名称: {item.product_name}"
    for key, value in update_data.items():
        setattr(item, key, value)
    new_values = f"SKU: {item.sku}, 数量: {item.quantity}, 名称: {item.product_name}"
    db.commit()
    db.refresh(item)
    create_change_log(
        db, current_user.id, item.node_id,
        "inventory_update", f"更新库存条目: {item.product_name}",
        old_values, new_values
    )
    return item


@router.delete("/items/{item_id}")
async def delete_inventory_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="库存条目不存在")
    create_change_log(
        db, current_user.id, item.node_id,
        "inventory_delete", f"删除库存条目: {item.product_name}",
        f"SKU: {item.sku}, 数量: {item.quantity}", ""
    )
    db.delete(item)
    db.commit()
    return {"message": "库存条目已删除"}


@router.get("/changelogs", response_model=list[ChangeLogResponse])
async def list_changelogs(
    node_id: Optional[int] = None,
    change_type: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(ChangeLog)
    if node_id is not None:
        descendant_ids = get_descendant_ids(db, node_id)
        query = query.filter(ChangeLog.node_id.in_(descendant_ids))
    if change_type:
        query = query.filter(ChangeLog.change_type == change_type)
    logs = query.order_by(ChangeLog.created_at.desc()).limit(limit).all()
    result = []
    for log in logs:
        user = db.query(User).filter(User.id == log.user_id).first()
        result.append(
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
    return result


@router.post("/changelogs", response_model=ChangeLogResponse)
async def create_changelog(
    log_data: ChangeLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "staff")),
):
    log = ChangeLog(
        node_id=log_data.node_id,
        user_id=current_user.id,
        change_type=log_data.change_type,
        description=log_data.description,
        old_value=log_data.old_value,
        new_value=log_data.new_value,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return ChangeLogResponse(
        id=log.id,
        node_id=log.node_id,
        user_id=log.user_id,
        change_type=log.change_type,
        description=log.description,
        old_value=log.old_value,
        new_value=log.new_value,
        created_at=log.created_at,
        username=current_user.username,
    )


@router.get("/export")
async def export_inventory(
    node_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(InventoryItem)
    if node_id is not None:
        descendant_ids = get_descendant_ids(db, node_id)
        query = query.filter(InventoryItem.node_id.in_(descendant_ids))
    items = query.all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["SKU", "商品名称", "数量", "最低库存", "单位", "所属节点ID", "更新时间"])
    for item in items:
        writer.writerow([item.sku, item.product_name, item.quantity, item.min_quantity, item.unit, item.node_id, item.updated_at])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=inventory_export.csv"},
    )


@router.post("/transfer", response_model=TransferResponse)
async def transfer_inventory(
    transfer_data: TransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "staff")),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == transfer_data.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="库存条目不存在")

    if transfer_data.quantity <= 0:
        raise HTTPException(status_code=400, detail="调拨数量必须大于0")

    if transfer_data.quantity > item.quantity:
        raise HTTPException(status_code=400, detail=f"调拨数量({transfer_data.quantity})超过库存数量({item.quantity})")

    if transfer_data.to_node_id == item.node_id:
        raise HTTPException(status_code=400, detail="目标节点不能与来源节点相同")

    to_node = db.query(Node).filter(Node.id == transfer_data.to_node_id).first()
    if not to_node:
        raise HTTPException(status_code=400, detail="目标节点不存在")

    from_node = db.query(Node).filter(Node.id == item.node_id).first()
    from_node_name = from_node.name if from_node else ""
    to_node_name = to_node.name

    old_quantity = item.quantity
    item.quantity = item.quantity - transfer_data.quantity
    db.commit()
    db.refresh(item)

    create_change_log(
        db, current_user.id, item.node_id,
        "transfer_out",
        f"调出: {item.product_name} × {transfer_data.quantity} → {to_node_name}",
        f"数量: {old_quantity}",
        f"数量: {item.quantity}"
    )

    target_item = db.query(InventoryItem).filter(
        InventoryItem.node_id == transfer_data.to_node_id,
        InventoryItem.sku == item.sku
    ).first()

    if target_item:
        target_old_qty = target_item.quantity
        target_item.quantity = target_item.quantity + transfer_data.quantity
        db.commit()
        db.refresh(target_item)
        create_change_log(
            db, current_user.id, transfer_data.to_node_id,
            "transfer_in",
            f"调入: {item.product_name} × {transfer_data.quantity} ← {from_node_name}",
            f"数量: {target_old_qty}",
            f"数量: {target_item.quantity}"
        )
    else:
        new_item = InventoryItem(
            node_id=transfer_data.to_node_id,
            sku=item.sku,
            product_name=item.product_name,
            quantity=transfer_data.quantity,
            min_quantity=item.min_quantity,
            unit=item.unit,
        )
        db.add(new_item)
        db.commit()
        db.refresh(new_item)
        create_change_log(
            db, current_user.id, transfer_data.to_node_id,
            "transfer_in",
            f"调入(新建): {item.product_name} × {transfer_data.quantity} ← {from_node_name}",
            "",
            f"数量: {transfer_data.quantity}"
        )

    transfer_record = TransferRecord(
        item_id=item.id,
        sku=item.sku,
        product_name=item.product_name,
        from_node_id=item.node_id,
        to_node_id=transfer_data.to_node_id,
        quantity=transfer_data.quantity,
        remark=transfer_data.remark,
        user_id=current_user.id,
    )
    db.add(transfer_record)
    db.commit()
    db.refresh(transfer_record)

    return TransferResponse(
        id=transfer_record.id,
        item_id=transfer_record.item_id,
        sku=transfer_record.sku,
        product_name=transfer_record.product_name,
        from_node_id=transfer_record.from_node_id,
        from_node_name=from_node_name,
        to_node_id=transfer_record.to_node_id,
        to_node_name=to_node_name,
        quantity=transfer_record.quantity,
        remark=transfer_record.remark,
        user_id=transfer_record.user_id,
        username=current_user.username,
        created_at=transfer_record.created_at,
    )


@router.get("/transfers", response_model=list[TransferResponse])
async def list_transfers(
    node_id: Optional[int] = None,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(TransferRecord)
    if node_id is not None:
        query = query.filter(
            (TransferRecord.from_node_id == node_id) | (TransferRecord.to_node_id == node_id)
        )
    records = query.order_by(TransferRecord.created_at.desc()).limit(limit).all()
    result = []
    for rec in records:
        from_node = db.query(Node).filter(Node.id == rec.from_node_id).first()
        to_node = db.query(Node).filter(Node.id == rec.to_node_id).first()
        user = db.query(User).filter(User.id == rec.user_id).first()
        result.append(
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
                username=user.username if user else None,
                created_at=rec.created_at,
            )
        )
    return result
