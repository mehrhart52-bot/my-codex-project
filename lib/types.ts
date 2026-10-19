export type User = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: "supporter" | "social_worker" | "admin";
  approved: boolean;
  active: boolean;
};
export type RequestRow = {
  id: string;
  number: string;
  owner_id: string;
  summary: string;
  narrative?: string;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
  owner_name: string;
  needed: string;
  committed: string;
};
export type Item = {
  id: string;
  catalog_id: number;
  name: string;
  quantity: number;
  committed: number;
};
export type RequestDetail = RequestRow & {
  owner_email?: string;
  owner_phone?: string;
};
export type Commitment = {
  id: string;
  item_id: string;
  supporter_id: string;
  quantity: number;
  status: string;
  modifiable: boolean;
  created_at: Date | string;
  name: string;
  number: string;
  request_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
};
export const canCreate = (u: User) =>
  u.role === "admin" || (u.role === "social_worker" && u.approved);
export const canManage = (u: User, r: { owner_id: string }) =>
  u.role === "admin" || (canCreate(u) && r.owner_id === u.id);

export const landingPage = (user: Pick<User, "role">) =>
  user.role === "social_worker" ? "/dashboard" : "/requests";
