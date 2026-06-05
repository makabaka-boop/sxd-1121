from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base, SessionLocal
from models import User, Node, InventoryItem
from auth import get_password_hash
from routers.auth_router import router as auth_router
from routers.nodes import router as nodes_router
from routers.inventory import router as inventory_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="门店区域层级与库存管理系统", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(nodes_router)
app.include_router(inventory_router)


@app.on_event("startup")
def seed_data():
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            admin = User(
                username="admin",
                hashed_password=get_password_hash("admin123"),
                role="admin",
                display_name="系统管理员",
            )
            staff = User(
                username="staff",
                hashed_password=get_password_hash("staff123"),
                role="staff",
                display_name="门店人员",
            )
            observer = User(
                username="observer",
                hashed_password=get_password_hash("observer123"),
                role="observer",
                display_name="观察员",
            )
            db.add_all([admin, staff, observer])

        if db.query(Node).count() == 0:
            area1 = Node(name="A区", node_type="area", parent_id=None, code="A", description="A区主仓储区", sort_order=1)
            area2 = Node(name="B区", node_type="area", parent_id=None, code="B", description="B区生鲜区", sort_order=2)
            area3 = Node(name="C区", node_type="area", parent_id=None, code="C", description="C区日用品区", sort_order=3)
            db.add_all([area1, area2, area3])
            db.flush()

            aisle_a1 = Node(name="A1通道", node_type="aisle", parent_id=area1.id, code="A-1", description="A区1号通道", sort_order=1)
            aisle_a2 = Node(name="A2通道", node_type="aisle", parent_id=area1.id, code="A-2", description="A区2号通道", sort_order=2)
            aisle_b1 = Node(name="B1通道", node_type="aisle", parent_id=area2.id, code="B-1", description="B区1号通道", sort_order=1)
            db.add_all([aisle_a1, aisle_a2, aisle_b1])
            db.flush()

            shelf_a1_1 = Node(name="A1-1货架", node_type="shelf", parent_id=aisle_a1.id, code="A-1-1", description="A1通道1号货架", sort_order=1)
            shelf_a1_2 = Node(name="A1-2货架", node_type="shelf", parent_id=aisle_a1.id, code="A-1-2", description="A1通道2号货架", sort_order=2)
            shelf_a2_1 = Node(name="A2-1货架", node_type="shelf", parent_id=aisle_a2.id, code="A-2-1", description="A2通道1号货架", sort_order=1)
            shelf_b1_1 = Node(name="B1-1货架", node_type="shelf", parent_id=aisle_b1.id, code="B-1-1", description="B1通道1号货架", sort_order=1)
            db.add_all([shelf_a1_1, shelf_a1_2, shelf_a2_1, shelf_b1_1])
            db.flush()

            slot_a1_1_1 = Node(name="A1-1-1格位", node_type="slot", parent_id=shelf_a1_1.id, code="A-1-1-1", description="上层", sort_order=1)
            slot_a1_1_2 = Node(name="A1-1-2格位", node_type="slot", parent_id=shelf_a1_1.id, code="A-1-1-2", description="中层", sort_order=2)
            slot_a1_1_3 = Node(name="A1-1-3格位", node_type="slot", parent_id=shelf_a1_1.id, code="A-1-1-3", description="下层", sort_order=3)
            slot_a1_2_1 = Node(name="A1-2-1格位", node_type="slot", parent_id=shelf_a1_2.id, code="A-1-2-1", description="上层", sort_order=1)
            slot_a2_1_1 = Node(name="A2-1-1格位", node_type="slot", parent_id=shelf_a2_1.id, code="A-2-1-1", description="上层", sort_order=1)
            slot_b1_1_1 = Node(name="B1-1-1格位", node_type="slot", parent_id=shelf_b1_1.id, code="B-1-1-1", description="冷藏区", sort_order=1)
            db.add_all([slot_a1_1_1, slot_a1_1_2, slot_a1_1_3, slot_a1_2_1, slot_a2_1_1, slot_b1_1_1])
            db.flush()

            sample_items = [
                InventoryItem(node_id=slot_a1_1_1.id, sku="SKU001", product_name="矿泉水550ml", quantity=120, min_quantity=20, unit="瓶"),
                InventoryItem(node_id=slot_a1_1_1.id, sku="SKU002", product_name="可乐330ml", quantity=80, min_quantity=15, unit="罐"),
                InventoryItem(node_id=slot_a1_1_2.id, sku="SKU003", product_name="薯片原味", quantity=5, min_quantity=10, unit="袋"),
                InventoryItem(node_id=slot_a1_1_3.id, sku="SKU004", product_name="方便面桶装", quantity=0, min_quantity=10, unit="桶"),
                InventoryItem(node_id=slot_a1_2_1.id, sku="SKU005", product_name="饼干礼盒", quantity=35, min_quantity=5, unit="盒"),
                InventoryItem(node_id=slot_a2_1_1.id, sku="SKU006", product_name="洗衣液1L", quantity=45, min_quantity=8, unit="瓶"),
                InventoryItem(node_id=slot_b1_1_1.id, sku="SKU007", product_name="鲜牛奶1L", quantity=20, min_quantity=10, unit="盒"),
                InventoryItem(node_id=slot_b1_1_1.id, sku="SKU008", product_name="酸奶200g", quantity=0, min_quantity=15, unit="杯"),
            ]
            db.add_all(sample_items)

        db.commit()
    finally:
        db.close()


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "门店区域层级与库存管理系统"}
