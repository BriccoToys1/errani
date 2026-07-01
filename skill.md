---
name: errani-admin-ui
description: Use this skill when editing, creating, reviewing, or refactoring the Errani admin panel UI at admin.errani.ru/admin: dashboard, products, inventory, orders, customers, media, settings, login, forms, tables, filters, CRUD pages, and admin navigation. Do not use this skill for the public errani.ru storefront unless explicitly asked.
---

You are working on the Errani admin panel.

Main objective:
Create and maintain a clean, practical, premium admin interface for managing the Errani tarot ecommerce project. The admin panel must be functional first, visually consistent second, and never look like a generic SaaS template.

Project context:
- Admin URL: https://admin.errani.ru/admin
- Public brand: errani
- Product type: author tarot decks
- Current public products/collections include Gothic Vibe and Tenderly Vibe
- Admin is for managing ecommerce operations: products, stock, orders, media, content, settings, and customer/order workflows.

Technology assumptions:
- Respect the existing project stack and structure.
- Inspect existing files before creating new patterns.
- Reuse existing components, layout wrappers, tokens, Tailwind utilities, Prisma models, API routes, server actions, and validation patterns when available.
- Do not invent a parallel UI system if the project already has one.

Admin UI direction:
- Clean, premium, calm, modern.
- More functional than the public storefront.
- Keep a subtle Errani identity: soft gothic, muted, elegant, slightly mystical.
- Do not make the admin panel overly decorative.
- Avoid aggressive Liquid Glass unless explicitly requested.
- Avoid generic bright blue SaaS styling.
- Avoid corporate logistics style.
- Avoid marketplace-looking clutter.

Visual principles:
- Backgrounds should be calm: near-white, warm ivory, soft gray, deep graphite, muted burgundy, dusty rose, smoky violet when appropriate.
- Cards should have generous radius, subtle borders, soft shadows, and clear hierarchy.
- Tables should be readable, compact, and operational.
- Forms should be clean, aligned, and easy to scan.
- Buttons should have clear hierarchy: primary, secondary, destructive, ghost.
- Status badges should be visually consistent and easy to understand.
- Navigation should be stable and predictable.
- Empty states should be helpful and action-oriented.
- Loading states should be calm and not flashy.
- Modals and drawers should be focused and accessible.

Admin UX rules:
- Prioritize speed and clarity over visual effects.
- Every CRUD screen should make the next action obvious.
- Search, filters, sorting, pagination, and bulk actions should be available where they make operational sense.
- Destructive actions must require confirmation.
- Product and order pages must preserve data carefully.
- Forms must have validation, helpful error messages, and save/cancel states.
- Do not hide important admin controls behind unclear icons.
- Mobile support matters, but desktop admin use is primary.
- On mobile, use readable stacked cards instead of squeezed desktop tables.

Recommended admin sections:
- Dashboard overview
- Products
- Collections
- Inventory / stock
- Orders
- Customers
- Promo codes / discounts
- Media library
- Pages / content
- Delivery settings
- Payment settings
- Admin users / roles
- Audit / activity log
- Settings

Product admin rules:
- Product list should show image, name, collection, status, price, stock, preorder/sale state, updated date, and quick actions.
- Product edit page should clearly separate:
  - Basic info
  - Images/media
  - Pricing
  - Stock
  - SEO
  - Visibility/status
  - Product details
- Image management should be visual and simple.
- Do not make product editing feel like raw database editing.

Order admin rules:
- Order list should show order number, customer, status, payment status, total, date, and quick actions.
- Order detail should show customer info, items, payment, delivery, comments, timeline, and admin notes.
- Status changes should be explicit and traceable.
- Avoid accidental status changes.

Inventory rules:
- Stock movements should be auditable.
- Show current stock, reserved stock, available stock if the data model supports it.
- Prefer clear stock adjustment flows instead of directly editing numbers without context.
- Low-stock and out-of-stock states should be obvious.

Accessibility:
- Use semantic HTML.
- Keep focus states visible.
- Labels must be connected to inputs.
- Icon-only buttons need aria-label.
- Color must not be the only indicator of meaning.
- Keep contrast readable.

Code rules:
- Return production-ready code.
- Use TypeScript types where relevant.
- Keep components composable.
- Avoid unnecessary dependencies.
- Avoid dead code.
- Do not add comments unless requested.
- Do not rewrite unrelated parts of the project.
- If editing existing files, preserve existing naming conventions.
- If creating new components, place them in the most appropriate existing folder.
- Prefer small, maintainable components over huge monolithic files.

Before finalizing any UI change:
- Check desktop layout.
- Check mobile layout.
- Check empty/loading/error states.
- Check form validation.
- Check table overflow.
- Check button hierarchy.
- Check that the result feels like Errani admin, not a generic dashboard template.


nano .agents/skills/errani-admin-ui/references/admin-design-system.md


# Errani Admin UI Reference

## Purpose

The Errani admin panel is an operational ecommerce dashboard for managing tarot deck products, stock, orders, customers, media, and settings.

It should be:
- fast
- clear
- premium
- calm
- structured
- reliable
- easy to use daily

It should not be:
- overly decorative
- generic SaaS
- neon
- cluttered
- public-storefront-like
- hard to scan

## Visual identity

The admin panel should keep a subtle link to the Errani brand:
- soft gothic
- muted romantic tones
- elegant cards
- calm shadows
- premium spacing
- beautiful but practical controls

Public storefront can be emotional and atmospheric.
Admin panel must be operational and clear.

## Layout

Preferred structure:
- left sidebar or top admin navigation
- clear page title
- compact action bar
- stats cards where useful
- main content card/table/form
- secondary side panel only when helpful

## Tables

Tables should support:
- search
- filters
- sorting
- pagination
- row actions
- status badges
- responsive fallback

Mobile tables should become stacked cards when needed.

## Forms

Forms should be grouped into clear sections:
- basic information
- media
- pricing
- inventory
- SEO
- visibility/status
- additional settings

Every form should have:
- clear labels
- validation
- save/cancel actions
- loading state
- success/error feedback

## Statuses

Use consistent status patterns.

Product statuses:
- draft
- active
- hidden
- sold out
- preorder

Order statuses:
- new
- paid
- processing
- shipped
- completed
- cancelled
- refunded

Payment statuses:
- pending
- paid
- failed
- refunded

## Components to reuse or create

Useful admin components:
- AdminShell
- AdminSidebar
- AdminHeader
- PageHeader
- StatCard
- DataTable
- FilterBar
- SearchInput
- StatusBadge
- EmptyState
- ConfirmDialog
- FormSection
- ImageUploader
- ProductPreviewCard
- OrderTimeline
- StockAdjustmentDialog


.agents/skills/errani-admin-ui/assets/screenshots/