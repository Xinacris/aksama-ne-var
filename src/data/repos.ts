import type {
  Activity,
  CookLog,
  Favorite,
  CookingSession,
  Household,
  ImportLog,
  Match,
  Member,
  PantryItem,
  PlanDay,
  PlanItem,
  PrepTask,
  Recipe,
  ShoppingCheck,
  ShoppingItem,
  Swipe,
  User,
} from "./models";

/**
 * Repository interfaces. UI and store code only ever talk to these;
 * `LocalStorageAdapter` is the single implementation today and a
 * `SupabaseAdapter` can implement the same contracts later.
 * All methods are async so a network-backed adapter fits without changes.
 */

/** Fields the repository fills in itself. */
export type NewRow<T> = Omit<T, "id" | "createdAt" | "updatedAt">;
export type Patch<T> = Partial<Omit<T, "id" | "createdAt" | "householdId">>;

export interface AuthRepo {
  findUserByEmail(email: string): Promise<User | null>;
  getUser(id: string): Promise<User | null>;
  listUsers(ids: string[]): Promise<User[]>;
  createUser(user: NewRow<User>): Promise<User>;
  updateUser(id: string, patch: Patch<User>): Promise<User>;
}

export interface HouseholdRepo {
  get(id: string): Promise<Household | null>;
  findByInviteCode(code: string): Promise<Household | null>;
  create(row: NewRow<Household>): Promise<Household>;
  update(id: string, patch: Patch<Household>): Promise<Household>;
  listMembers(householdId: string): Promise<Member[]>;
  membershipOf(userId: string): Promise<Member | null>;
  addMember(row: NewRow<Member>): Promise<Member>;
  removeMember(memberId: string): Promise<void>;
  listFavorites(householdId: string): Promise<Favorite[]>;
  addFavorite(row: NewRow<Favorite>): Promise<Favorite>;
  removeFavorite(id: string): Promise<void>;
}

export interface RecipeRepo {
  /** Built-in + this household's custom recipes. */
  list(householdId: string | null): Promise<Recipe[]>;
  get(id: string): Promise<Recipe | null>;
  create(row: Omit<Recipe, "id" | "createdAt" | "updatedAt">): Promise<Recipe>;
  update(id: string, patch: Patch<Recipe>): Promise<Recipe>;
  remove(id: string): Promise<void>;
}

export interface PlanRepo {
  listItems(householdId: string): Promise<PlanItem[]>;
  addItem(row: NewRow<PlanItem>): Promise<PlanItem>;
  updateItem(id: string, patch: Patch<PlanItem>): Promise<PlanItem>;
  removeItem(id: string): Promise<void>;
  listDays(householdId: string): Promise<PlanDay[]>;
  /** Insert or update the day row for (householdId, date). */
  upsertDay(householdId: string, date: string, patch: Patch<PlanDay>, createdBy: string): Promise<PlanDay>;
  listCookLog(householdId: string): Promise<CookLog[]>;
  addCookLog(row: NewRow<CookLog>): Promise<CookLog>;
}

export interface ShoppingRepo {
  listItems(householdId: string): Promise<ShoppingItem[]>;
  addItem(row: NewRow<ShoppingItem>): Promise<ShoppingItem>;
  removeItem(id: string): Promise<void>;
  listChecks(householdId: string): Promise<ShoppingCheck[]>;
  check(row: NewRow<ShoppingCheck>): Promise<ShoppingCheck>;
  uncheck(householdId: string, itemKey: string): Promise<void>;
  clearChecks(householdId: string): Promise<void>;
  listPantry(householdId: string): Promise<PantryItem[]>;
  addPantry(rows: NewRow<PantryItem>[]): Promise<PantryItem[]>;
  removePantry(id: string): Promise<void>;
  replacePantry(householdId: string, rows: NewRow<PantryItem>[]): Promise<void>;
}

export interface PrepTaskRepo {
  list(householdId: string): Promise<PrepTask[]>;
  /** Replace all tasks for the household (regenerated from the plan). */
  replaceAll(householdId: string, rows: (NewRow<PrepTask> & { id?: string })[]): Promise<PrepTask[]>;
  update(id: string, patch: Patch<PrepTask>): Promise<PrepTask>;
}

export interface SwipeRepo {
  listSwipes(householdId: string): Promise<Swipe[]>;
  addSwipe(row: NewRow<Swipe>): Promise<Swipe>;
  listMatches(householdId: string): Promise<Match[]>;
  addMatch(row: NewRow<Match>): Promise<Match>;
  updateMatch(id: string, patch: Patch<Match>): Promise<Match>;
}

export interface ActivityRepo {
  list(householdId: string, limit?: number): Promise<Activity[]>;
  add(row: NewRow<Activity>): Promise<Activity>;
}

export interface ImportLogRepo {
  list(householdId: string): Promise<ImportLog[]>;
  add(row: NewRow<ImportLog>): Promise<ImportLog>;
}

export interface CookingRepo {
  list(householdId: string): Promise<CookingSession[]>;
  create(row: NewRow<CookingSession>): Promise<CookingSession>;
  update(id: string, patch: Patch<CookingSession>): Promise<CookingSession>;
  remove(id: string): Promise<void>;
}

export interface Repos {
  auth: AuthRepo;
  households: HouseholdRepo;
  recipes: RecipeRepo;
  plan: PlanRepo;
  shopping: ShoppingRepo;
  prep: PrepTaskRepo;
  swipes: SwipeRepo;
  activity: ActivityRepo;
  imports: ImportLogRepo;
  cooking: CookingRepo;
  /** Remove every stored row (Ayarlar › Tüm verileri sıfırla). */
  resetAll(): Promise<void>;
  /** Dump all tables for export. */
  exportAll(): Promise<Record<string, unknown[]>>;
}
