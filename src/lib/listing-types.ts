/**
 * listing-types — single source of truth for marketplace_listings.listing_type.
 *
 * v11.1: the DB column still stores the original 5 values, but the product UI
 * treats every row as one unified "Listing". Type collapses into a small
 * coloured chip; it is no longer a primary filter or a create-flow step.
 *
 * Intents:
 *   - "offering"  → creator selling their own work/skill (service, products)
 *   - "request"   → creator looking for collaborators or paid help
 */
import { Briefcase, Search, Users, Package, Truck, type LucideIcon } from "lucide-react";

export type ListingType =
  | "service"
  | "digital_product"
  | "physical_product"
  | "project_request"
  | "collaboration";

export type ListingIntent = "offering" | "request";

export interface ListingTypeMeta {
  key: ListingType;
  label: string;       // short chip label
  longLabel: string;   // composer toggle label
  desc: string;        // composer toggle helper text
  intent: ListingIntent;
  icon: LucideIcon;
  /** Tailwind background+text classes for the chip */
  chip: string;
}

export const LISTING_TYPE_META: Record<ListingType, ListingTypeMeta> = {
  service: {
    key: "service",
    label: "Offering",
    longLabel: "Offering a service",
    desc: "I can do this for you",
    intent: "offering",
    icon: Briefcase,
    chip: "bg-primary/10 text-primary",
  },
  digital_product: {
    key: "digital_product",
    label: "Product",
    longLabel: "Selling a digital product",
    desc: "Downloadable, file, pack, preset",
    intent: "offering",
    icon: Package,
    chip: "bg-primary/10 text-primary",
  },
  physical_product: {
    key: "physical_product",
    label: "Product",
    longLabel: "Selling a physical product",
    desc: "Ships to a buyer",
    intent: "offering",
    icon: Truck,
    chip: "bg-primary/10 text-primary",
  },
  project_request: {
    key: "project_request",
    label: "Open call",
    longLabel: "Looking for help",
    desc: "I need someone to do this",
    intent: "request",
    icon: Search,
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  collaboration: {
    key: "collaboration",
    label: "Collab",
    longLabel: "Seeking collaborators",
    desc: "Let's work on this together",
    intent: "request",
    icon: Users,
    chip: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
  },
};

/** Safely look up meta with a service fallback for unknown values. */
export const listingMeta = (t: string | null | undefined): ListingTypeMeta =>
  LISTING_TYPE_META[(t as ListingType)] ?? LISTING_TYPE_META.service;

/** Two-option toggle shown inside the unified composer. */
export const COMPOSER_TYPES: ListingType[] = ["service", "project_request", "collaboration"];
