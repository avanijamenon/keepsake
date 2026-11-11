/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as collections from "../collections.js";
import type * as generation from "../generation.js";
import type * as lib_ai from "../lib/ai.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_curate from "../lib/curate.js";
import type * as lib_layout from "../lib/layout.js";
import type * as lib_quota from "../lib/quota.js";
import type * as lib_storage from "../lib/storage.js";
import type * as members from "../members.js";
import type * as pages from "../pages.js";
import type * as photos from "../photos.js";
import type * as scrapbooks from "../scrapbooks.js";
import type * as shared_templates from "../shared/templates.js";
import type * as shared_themes from "../shared/themes.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  collections: typeof collections;
  generation: typeof generation;
  "lib/ai": typeof lib_ai;
  "lib/auth": typeof lib_auth;
  "lib/curate": typeof lib_curate;
  "lib/layout": typeof lib_layout;
  "lib/quota": typeof lib_quota;
  "lib/storage": typeof lib_storage;
  members: typeof members;
  pages: typeof pages;
  photos: typeof photos;
  scrapbooks: typeof scrapbooks;
  "shared/templates": typeof shared_templates;
  "shared/themes": typeof shared_themes;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  r2: import("@convex-dev/r2/_generated/component.js").ComponentApi<"r2">;
};
