export type WebsiteSectionItem = { key?: string; name: string; description?: string };

export type WebsiteSection = {
  id: string;
  type: string;
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  items?: WebsiteSectionItem[];
  hidden?: boolean;
};

export type WebsitePage = {
  type: string;
  slug: string;
  title: string;
  description?: string;
  sections: WebsiteSection[];
};

export type WebsiteDocument = {
  schemaVersion?: number;
  pages: WebsitePage[];
  theme?: { primary?: string; secondary?: string; font?: string };
  navigation?: Array<{ label: string; href: string; order?: number }>;
  meta?: { title?: string; description?: string };
  unfinished?: string[];
};

export const LIBRARY: ReadonlyArray<{ type: string; label: string; blurb: string }>;

export const LOOKS: ReadonlyArray<{
  id: string;
  label: string;
  primary: string;
  secondary: string;
  font: string;
  stack: string[];
}>;

export function libraryLabel(type: string): string;
export function itemFields(type: string): { name: string; description: string; add: string } | null;
export function placeholderKey(sectionId: string): string;
export function createStarterSection(type: string, id: string): WebsiteSection;
export function blankItem(type: string, index: number): WebsiteSectionItem;
export function sectionUsesExampleCopy(section: WebsiteSection): boolean;
export function syncPlaceholders(content: WebsiteDocument): WebsiteDocument;
export function unfinishedLabel(content: { pages?: WebsitePage[] } | null | undefined, itemText: string): string;
export function insertSection(content: WebsiteDocument, pageSlug: string, index: number, type: string): { content: WebsiteDocument; sectionId: string };
export function moveSection(content: WebsiteDocument, pageSlug: string, sectionId: string, toIndex: number): WebsiteDocument;
export function moveSectionBy(content: WebsiteDocument, pageSlug: string, sectionId: string, direction: number): WebsiteDocument;
export function removeSection(content: WebsiteDocument, pageSlug: string, sectionId: string): WebsiteDocument;
export function patchSection(content: WebsiteDocument, pageSlug: string, sectionId: string, patch: Partial<WebsiteSection>): WebsiteDocument;
export function applyLook(content: WebsiteDocument, lookId: string, options?: { replaceSections?: boolean }): WebsiteDocument;
export function assertDraftReady(content: WebsiteDocument): void;
