from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class UserBase(BaseModel):
    username: str
    role: str = "observer"
    display_name: str = ""


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None


class NodeBase(BaseModel):
    name: str
    node_type: str
    parent_id: Optional[int] = None
    code: str
    description: str = ""
    sort_order: int = 0


class NodeCreate(NodeBase):
    pass


class NodeUpdate(BaseModel):
    name: Optional[str] = None
    node_type: Optional[str] = None
    parent_id: Optional[int] = None
    code: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None


class NodeResponse(NodeBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TreeNode(NodeResponse):
    children: List["TreeNode"] = []
    inventory_summary: Optional["InventorySummary"] = None


class InventoryItemBase(BaseModel):
    node_id: int
    sku: str
    product_name: str
    quantity: int = 0
    min_quantity: int = 0
    unit: str = "件"


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItemUpdate(BaseModel):
    sku: Optional[str] = None
    product_name: Optional[str] = None
    quantity: Optional[int] = None
    min_quantity: Optional[int] = None
    unit: Optional[str] = None


class InventoryItemResponse(InventoryItemBase):
    id: int
    updated_at: datetime

    class Config:
        from_attributes = True


class InventorySummary(BaseModel):
    total_quantity: int = 0
    total_items: int = 0
    out_of_stock_items: int = 0
    low_stock_items: int = 0


class ChangeLogBase(BaseModel):
    node_id: int
    change_type: str
    description: str = ""
    old_value: str = ""
    new_value: str = ""


class ChangeLogCreate(ChangeLogBase):
    pass


class ChangeLogResponse(ChangeLogBase):
    id: int
    user_id: int
    created_at: datetime
    username: Optional[str] = None

    class Config:
        from_attributes = True


class TransferCreate(BaseModel):
    item_id: int
    to_node_id: int
    quantity: int
    remark: str = ""


class TransferResponse(BaseModel):
    id: int
    item_id: int
    sku: str
    product_name: str
    from_node_id: int
    from_node_name: str
    to_node_id: int
    to_node_name: str
    quantity: int
    remark: str
    user_id: int
    username: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NodeAggregation(BaseModel):
    node_id: int
    node_name: str
    node_type: str
    summary: InventorySummary
    recent_changes: List[ChangeLogResponse] = []
    recent_transfers: List[TransferResponse] = []
    children: List["NodeAggregation"] = []


TreeNode.model_rebuild()
NodeAggregation.model_rebuild()
