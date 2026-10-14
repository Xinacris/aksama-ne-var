import type { Course } from "../data/models";

/** Onboarding step 1: the design's suggested dishes per group (built-in recipe ids), shown while the search is empty. */
export const ONBOARDING_GROUPS: { key: "soups" | "mains" | "sides" | "salads"; courses: Course[]; ids: string[] }[] = [
  { key: "soups", courses: ["corba"], ids: ["mercimek-corbasi", "ezogelin-corbasi", "tarhana-corbasi", "yayla-corbasi", "domates-corbasi", "tavuk-suyu-corba"] },
  { key: "mains", courses: ["ana", "kahvalti"], ids: ["kuru-fasulye", "izmir-kofte", "karniyarik", "imam-bayildi", "etli-nohut", "taze-fasulye", "tavuk-sote", "patates-oturtma", "manti", "firin-makarna", "menemen", "turlu"] },
  { key: "sides", courses: ["yaninda"], ids: ["tereyagli-pirinc-pilavi", "bulgur-pilavi", "sehriyeli-pilav", "makarna", "patates-kizartmasi"] },
  { key: "salads", courses: ["salata"], ids: ["cacik", "coban-salata", "piyaz", "gavurdagi", "haydari", "tursu"] },
];
