export interface User {
  id: number;
  username: string;
  role: string;
  display_name: string;
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface TreeNode {
  id: number;
  name: string;
  node_type: string;
  parent_id: number | null;
  code: string;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  children: TreeNode[];
}

export interface NodeCreate {
  name: string;
  node_type: string;
  parent_id: number | null;
  code: string;
  description?: string;
  sort_order?: number;
}

export interface NodeUpdate {
  name?: string;
  node_type?: string;
  parent_id?: number | null;
  code?: string;
  description?: string;
  sort_order?: number;
}

export interface InventoryItem {
  id: number;
  node_id: number;
  sku: string;
  product_name: string;
  quantity: number;
  min_quantity: number;
  unit: string;
  updated_at: string;
}

export interface InventoryItemCreate {
  node_id: number;
  sku: string;
  product_name: string;
  quantity?: number;
  min_quantity?: number;
  unit?: string;
}

export interface InventoryItemUpdate {
  sku?: string;
  product_name?: string;
  quantity?: number;
  min_quantity?: number;
  unit?: string;
}

export interface InventorySummary {
  total_quantity: number;
  total_items: number;
  out_of_stock_items: number;
  low_stock_items: number;
}

export interface ChangeLog {
  id: number;
  node_id: number;
  user_id: number;
  change_type: string;
  description: string;
  old_value: string;
  new_value: string;
  created_at: string;
  username?: string;
}

export interface NodeAggregation {
  node_id: number;
  node_name: string;
  node_type: string;
  summary: InventorySummary;
  recent_changes: ChangeLog[];
  recent_transfers: TransferRecord[];
  children: NodeAggregation[];
}

export interface TransferRecord {
  id: number;
  item_id: number;
  sku: string;
  product_name: string;
  from_node_id: number;
  from_node_name: string;
  to_node_id: number;
  to_node_name: string;
  quantity: number;
  remark: string;
  user_id: number;
  username?: string;
  created_at: string;
}

export interface TransferCreate {
  item_id: number;
  to_node_id: number;
  quantity: number;
  remark?: string;
}
