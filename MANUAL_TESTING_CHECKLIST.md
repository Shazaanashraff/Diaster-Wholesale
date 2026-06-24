# Manual Testing Checklist — Diaster Wholesale ERP

> **How to use:** Work through each section top-to-bottom. Tick each box as you verify it works correctly.  
> Mark items as: ✅ Pass | ❌ Fail (note the issue) | ⚠️ Partial

---

## Table of Contents

1. [Authentication & PIN Login](#1-authentication--pin-login)
2. [Dashboard](#2-dashboard)
3. [Products](#3-products)
4. [Customers](#4-customers)
5. [Customer Detail & Ledger](#5-customer-detail--ledger)
6. [Point of Sale (POS)](#6-point-of-sale-pos)
7. [Inventory](#7-inventory)
8. [Purchases](#8-purchases)
9. [Suppliers](#9-suppliers)
10. [Sales Returns](#10-sales-returns)
11. [Supplier Returns](#11-supplier-returns)
12. [Stock Transfers](#12-stock-transfers)
13. [Expenses / Day Transactions](#13-expenses--day-transactions)
14. [Salespeople](#14-salespeople)
15. [Reports](#15-reports)
16. [Cashier Page](#16-cashier-page)
17. [Bulk Import](#17-bulk-import)
18. [Cross-Cutting Features](#18-cross-cutting-features)

---

## 1. Authentication & PIN Login

### PIN Entry
- [ ] Open the app — PIN entry screen shows (not the dashboard)
- [ ] Entering a wrong PIN shows an error, does not log in
- [ ] Entering correct **Admin** PIN → redirects to Dashboard with full navigation
- [ ] Entering correct **Officer** PIN → redirects with officer-level navigation only
- [ ] Entering correct **Accountant** PIN → redirects with accountant-level navigation only
- [ ] Entering correct **POS Operator** PIN → redirects to POS-focused navigation
- [ ] Entering correct **Warehouse** PIN → redirects with warehouse-level navigation only
- [ ] Refresh page while logged in → stays logged in (session preserved)
- [ ] Close and reopen browser tab → PIN screen appears again (session cleared)

### Role-Based Access
- [ ] As POS Operator: navigating to `/products` is blocked or hidden
- [ ] As Warehouse: navigating to `/reports` is blocked or hidden
- [ ] As Admin: all pages are accessible

---

## 2. Dashboard

### Metrics Tiles
- [ ] Revenue tile shows a number (not blank or 0 when sales exist)
- [ ] Expenses tile shows correct total
- [ ] Customer Count tile matches number of customers in `/customers`
- [ ] Low Stock Alerts tile shows count of items below threshold
- [ ] Net Profit shows positive in green / negative in red

### Charts & Panels
- [ ] Profit & Expenses timeline (6-month area chart) renders without error
- [ ] Top Performers bar chart renders
- [ ] Toggle Top Performers period: **Day** → numbers change
- [ ] Toggle Top Performers period: **Month** → numbers change
- [ ] Toggle Top Performers period: **All Time** → shows all-time totals
- [ ] Category Distribution chart renders
- [ ] Recent Sales list shows latest transactions

### Navigation
- [ ] Clicking a metric tile navigates to the relevant page (e.g., Low Stock → Inventory)
- [ ] Overview / Detailed tab toggle works
- [ ] Right panel collapse/expand button works

---

## 3. Products

### Read / List View
- [ ] Products page loads and shows a list of active products
- [ ] Each product row shows: name, item code, wholesale price, retail price, stock
- [ ] Loading skeleton shows while data is being fetched
- [ ] "No products found" state shows when list is empty

### Search & Filter
- [ ] Search by product **name** → list filters correctly
- [ ] Search by **item code** → correct product appears
- [ ] Clear search → all products return
- [ ] Filter by **category** → only that category's products show
- [ ] Apply multiple filters simultaneously → results are correct
- [ ] Filter badge/count updates when filters are active
- [ ] Sort by **Name** (A→Z and Z→A)
- [ ] Sort by **Wholesale Price** (low→high and high→low)
- [ ] Sort by **Retail Price** (low→high and high→low)
- [ ] Switch to **Archived** view → shows only archived products
- [ ] Switch back to **Active** view → shows active products again
- [ ] Refresh button reloads data without page refresh

### Create Product
- [ ] Click Add Product → form/modal opens
- [ ] Submit with all fields empty → validation errors shown
- [ ] Fill all required fields → product saves successfully
- [ ] Newly created product appears in the list immediately
- [ ] Item code is auto-generated (6-digit unique code)
- [ ] Submitting a product with a **duplicate name** → warning shown
- [ ] Confirming the duplicate name warning on second submit → product saves
- [ ] Setting an initial quantity → stock adjustment is created

### Edit Product
- [ ] Click Edit on a product → edit form opens pre-filled with existing data
- [ ] Change name/price → save → product list reflects the change
- [ ] Change pieces per carton → value saves correctly
- [ ] Saving with required fields cleared → validation errors shown

### Archive / Delete Product
- [ ] Archive a product → it disappears from Active list
- [ ] Archived product appears in Archived view
- [ ] (Admin only) Hard delete → shows preview of affected records
- [ ] Confirm hard delete → product removed from all views

---

## 4. Customers

### Read / List View
- [ ] Customer list loads with name, phone, type, outstanding balance, credit limit
- [ ] Loading state / skeleton shows while fetching
- [ ] Empty state message shows if no customers

### Search & Filter
- [ ] Search by **name** → filters correctly
- [ ] Search by **phone number** → correct customer appears
- [ ] Search by **email** → correct customer appears
- [ ] Filter by type **Wholesale** → only wholesale customers show
- [ ] Filter by type **Retail** → only retail customers show
- [ ] Clear all filters → full list returns
- [ ] Sort by **Name** (A→Z)
- [ ] Sort by **Outstanding Balance** (high→low)
- [ ] Sort by **Credit Limit** (high→low)
- [ ] Customer count updates when filters are applied

### Create Customer
- [ ] Click Add Customer → form opens
- [ ] Submit with empty required fields → validation errors shown
- [ ] Fill name, phone, type → customer saves
- [ ] New customer appears in list immediately
- [ ] Setting a **credit limit** → value is stored and displayed
- [ ] Customer type (Wholesale/Retail) saves correctly

### Edit Customer
- [ ] Open customer detail → edit form/button visible
- [ ] Change phone/email/address → save → detail page reflects update
- [ ] Change credit limit → new value shows immediately

### Archive Customer
- [ ] Archive a customer → removed from main list
- [ ] Archived customer no longer appears in POS customer dropdown

---

## 5. Customer Detail & Ledger

### Profile View
- [ ] Correct customer name, phone, email, address shown
- [ ] Outstanding balance displayed
- [ ] Credit limit and available credit shown
- [ ] Available credit = Credit Limit − Outstanding Balance

### Invoice Ledger
- [ ] All invoices for the customer are listed
- [ ] Each invoice shows: date, invoice number, total, amount paid, status
- [ ] Invoice status shows correctly: **Paid / Partial / Unpaid**
- [ ] Clicking an invoice opens the invoice detail

### Payment Recording
- [ ] Click "Record Payment" → form opens
- [ ] Select a specific invoice from the dropdown → form pre-fills invoice total
- [ ] Enter an amount greater than the invoice total → validation error or warning
- [ ] Enter a valid amount → payment saves
- [ ] Outstanding balance on customer profile **decreases** after payment
- [ ] Invoice status updates (Unpaid → Partial → Paid) as payments are added
- [ ] Payment appears in the payment history tab/list
- [ ] Record a **general payment** (not tied to a specific invoice) → saves and reduces balance

### Payment History
- [ ] Payment history list shows all payments with date, amount, method
- [ ] Payment amounts match what was entered

---

## 6. Point of Sale (POS)

### Product Search & Cart
- [ ] Search for a product by name → product appears in results
- [ ] Search for a product by item code → correct product appears
- [ ] Filter products by category → filtered results show
- [ ] Click a product → adds to cart
- [ ] Increase quantity in cart → total updates
- [ ] Decrease quantity in cart to 0 → item removed from cart
- [ ] Remove item from cart with delete button → item removed, total updates

### Customer Selection
- [ ] Open customer dropdown → existing customers appear
- [ ] Search for a customer in the dropdown → filtered results
- [ ] Select a customer → pricing mode auto-switches (Wholesale/Retail based on type)
- [ ] Create a **new customer inline** at POS → form appears, fill name + phone + type → saves and auto-selects in dropdown
- [ ] Customer with credit limit: check credit display shows available credit

### Pricing Modes
- [ ] Toggle **Wholesale mode** → cart prices switch to wholesale prices
- [ ] Toggle **Retail mode** → cart prices switch to retail prices
- [ ] Manually override a unit price → price updates in cart
- [ ] Price override requires admin PIN (role-based approval)

### Discounts
- [ ] Enter a manual discount → cart total recalculates
- [ ] Discount requiring approval → approval PIN prompt appears
- [ ] Enter wrong approval PIN → discount not applied
- [ ] Enter correct approval PIN → discount applies

### Loyalty Points (if customer selected)
- [ ] Customer with existing points: points balance shown
- [ ] Toggle redeem points → discount applied (1 point = LKR 1)
- [ ] After sale: customer earns new points (1 per LKR 100)
- [ ] Points balance updates in customer profile after sale

### Stock Enforcement
- [ ] Toggle **enforce stock** ON → adding more than available stock prevents the action
- [ ] Toggle **enforce stock** OFF → able to oversell
- [ ] Low-stock product shows a warning indicator

### Payment Processing
- [ ] Select payment method **Cash** → enter amount → checkout
- [ ] Select payment method **Card** → enter amount → checkout
- [ ] Select payment method **Cheque** → cheque number and due date fields appear
- [ ] Select payment method **Online/Bank Transfer** → bank name field appears
- [ ] Add a **split payment** (e.g., part cash + part card) → totals split correctly
- [ ] Split payment amounts sum to less than total → checkout blocked or creates partial invoice
- [ ] Credit/outstanding payment option → invoice created as unpaid
- [ ] Auto-fill full total when split amount field is empty

### Checkout & Receipt
- [ ] Complete a sale → success confirmation appears
- [ ] Invoice is created → appears in customer ledger
- [ ] Stock decreases for each sold product
- [ ] Customer outstanding balance updates if payment is partial or credit
- [ ] Receipt / print view opens after sale
- [ ] Cart clears after successful checkout

### Salesperson Tracking
- [ ] Select a salesperson before checkout → sale is attributed to them
- [ ] Salesperson sales appear on their profile page

### Offline Mode
- [ ] Disable internet → attempt a sale → sale queues offline
- [ ] Pending sales count shows in UI
- [ ] Restore internet → queued sales sync automatically
- [ ] Synced sales appear in customer ledger

---

## 7. Inventory

### Stock View
- [ ] Inventory page loads with all products and their stock levels
- [ ] Stock shown in cartons and pieces
- [ ] Per-location view (Warehouse / Shop) works
- [ ] Switching between locations updates stock numbers

### Filtering
- [ ] Filter by **Low Stock** → shows only items below threshold
- [ ] Change low-stock threshold (in localStorage or settings) → filter updates
- [ ] Search by product name → correct items shown
- [ ] Sort by stock level (high→low, low→high)

### Stock Adjustments
- [ ] Click "Adjust Stock" → form opens
- [ ] Select adjustment type: **Damage** → saves correctly, stock decreases
- [ ] Select adjustment type: **Recount** → stock set to new value
- [ ] Select adjustment type: **Return** → stock increases
- [ ] Select adjustment type: **Other** → saves with required reason
- [ ] Submit without a reason → validation error shown
- [ ] Adjustment for a specific location (Warehouse vs Shop) → only that location changes
- [ ] Adjustment appears in stock ledger/history

### Stock Ledger
- [ ] Open a product's stock history → all adjustments and movements listed
- [ ] Purchases (received stock) appear as positive entries
- [ ] Sales appear as negative entries
- [ ] Manual adjustments appear with type and reason
- [ ] Timestamps are correct

---

## 8. Purchases

### List View
- [ ] Purchases list loads with reference, supplier, status, total
- [ ] Filter by status: **Draft** → only draft purchases show
- [ ] Filter by status: **Ordered** → only ordered purchases show
- [ ] Filter by status: **Received** → only received purchases show
- [ ] Filter by status: **Completed** → only completed purchases show
- [ ] Filter by status: **Cancelled** → only cancelled purchases show
- [ ] Filter **All** → all purchases show
- [ ] Search by reference number → correct purchase appears
- [ ] Search by supplier name → correct purchases appear

### Create Purchase
- [ ] Click Create Purchase → form opens
- [ ] Select a supplier from the dropdown
- [ ] Add a line item: search product by name → product selected
- [ ] Add a line item: search product by item code → product selected
- [ ] Set quantity (cartons and/or pieces) and unit price
- [ ] Add a second line item → both appear in the list
- [ ] Remove a line item → it disappears from the list
- [ ] Create a **new product inline** from the purchase form → product saved and selected
- [ ] Save as Draft → purchase appears in Drafts list
- [ ] Currency toggle (RMB / LKR) → price display changes

### Purchase Status Workflow
- [ ] Draft → click "Mark as Ordered" → confirmation prompt appears → confirm → status changes to Ordered
- [ ] Ordered → click "Receive Stock" → receiving form opens per item
- [ ] Enter received quantity and damage quantity per item → save
- [ ] Received stock appears in inventory after receiving
- [ ] Damage quantity is tracked separately
- [ ] Received → click "Complete" → finalize costing → status changes to Completed
- [ ] Any status → click "Cancel" → confirmation prompt → status changes to Cancelled
- [ ] Cancelled purchase does NOT add stock to inventory

### Costing
- [ ] Add a cost line: **Shipping** → amount saved
- [ ] Add a cost line: **Clearing** → amount saved
- [ ] Add a cost line: **Tax** → amount saved
- [ ] Add a cost line: **Other** → amount saved with description
- [ ] Total cost updates to include all cost lines
- [ ] Cost per piece is calculated and displayed

### Supplier Payments (on purchase)
- [ ] Record a payment against a purchase → payment saves
- [ ] Multiple payments on one purchase → all listed in payment history
- [ ] Edit an existing payment → updated value saves
- [ ] Delete a payment → payment removed, supplier balance adjusts

### Discount Approvals
- [ ] Add a discount to a purchase item → pending approval created
- [ ] As Admin/Accountant: approve the discount → it applies
- [ ] Reject the discount → it is removed

### Edit & Delete
- [ ] Edit a **Draft** purchase: change item quantity → saves correctly
- [ ] Delete a Draft purchase → purchase removed
- [ ] (Admin only) Force delete a Completed purchase → purchase removed with warning

---

## 9. Suppliers

### List View
- [ ] Supplier list loads with name, country, outstanding balance
- [ ] Search by supplier name → filters correctly
- [ ] Search by country → filters correctly

### Create Supplier
- [ ] Click Add Supplier → form opens
- [ ] Submit with empty name → validation error
- [ ] Fill name, contact, phone, email, country, notes → saves successfully
- [ ] New supplier appears in list and is available in Purchases dropdown

### Edit Supplier
- [ ] Click edit on a supplier → form pre-fills with existing data
- [ ] Change phone/email → save → detail page reflects change
- [ ] Change country → saves correctly

### Supplier Ledger
- [ ] Open supplier detail → **Purchases** tab shows all purchase orders
- [ ] Each purchase shows: reference, date, status, amount
- [ ] **Payments** tab shows all payments made to this supplier
- [ ] Each payment shows: date, amount, method, notes
- [ ] Outstanding balance = total purchases minus total payments

### Record Supplier Payment
- [ ] Click "Record Payment" → payment form opens
- [ ] Select payment method: Cash / Cheque / Bank Transfer / Online
- [ ] Cheque method: cheque number field appears
- [ ] Bank Transfer / Online: bank name field appears
- [ ] Enter amount and notes → payment saves
- [ ] Supplier outstanding balance **decreases** after payment
- [ ] Payment appears in Payments tab

### Archive Supplier
- [ ] Archive a supplier → no longer appears in active list
- [ ] Archived supplier no longer available in Purchases supplier dropdown

---

## 10. Sales Returns

### List View
- [ ] Returns list loads with return number, customer, status, date
- [ ] Filter by **Pending** status → shows only pending returns
- [ ] Filter by **Completed** status → shows only completed returns
- [ ] Filter by **Cancelled** status → shows only cancelled returns
- [ ] Search by return number → correct return appears
- [ ] Search by customer name → correct returns appear

### Create Return
- [ ] Click Create Return → form opens
- [ ] Select a customer and then select an invoice from their invoice history
- [ ] Invoice items populate automatically
- [ ] Select items to return and enter return quantity
- [ ] Return quantity cannot exceed original invoice quantity
- [ ] Select return reason: Damaged / Defective / Wrong Item / Changed Mind / Other
- [ ] Return saves as Pending

### Return with Replacement (Exchange)
- [ ] Add replacement items to the return
- [ ] Replacement quantity and product selectable
- [ ] Settlement type: **Refund** → refund amount calculated
- [ ] Settlement type: **Customer Owes More** (payable) → additional charge calculated
- [ ] Settlement type: **Credit Note** → credit created for customer
- [ ] Settlement type: **Even Exchange** → no money changes hands
- [ ] Save return → return created with correct status and amounts

### Complete Return
- [ ] Open a Pending return → "Complete" button visible
- [ ] Click Complete → status changes to Completed
- [ ] Returned items' stock is **restored** in inventory
- [ ] Replacement items' stock is **deducted** from inventory
- [ ] Customer outstanding balance updates if refund issued

### Cancel Return
- [ ] Open a Pending return → "Cancel" button visible
- [ ] Cancel with confirmation → status changes to Cancelled
- [ ] Stock is NOT affected when a return is cancelled

---

## 11. Supplier Returns

### List View
- [ ] Supplier returns list loads with reference, supplier, status, date
- [ ] Filter by status: Pending / Completed / Cancelled
- [ ] Search by reference or supplier name

### Create Supplier Return
- [ ] Click Create → form opens
- [ ] Select supplier
- [ ] Optionally link to a purchase
- [ ] Select type: Return or Exchange
- [ ] Add items with type (return / replacement), quantity, unit value
- [ ] Total difference calculated (replacements vs returns)
- [ ] Settlement option selected (payable, refund, credit note, even)
- [ ] Return saves as Pending

### Complete Supplier Return
- [ ] Complete a Pending return → status changes to Completed
- [ ] Supplier balance adjusts based on settlement

### Print Supplier Return
- [ ] Open a completed return → Print button available
- [ ] Print/PDF view renders correctly with all item details

---

## 12. Stock Transfers

### List View
- [ ] Transfers list loads with reference, from/to location, status, date
- [ ] Filter by Pending / Completed / Cancelled

### Create Transfer
- [ ] Click Create Transfer → form opens
- [ ] Select source location (Warehouse or Shop)
- [ ] Select destination location (must differ from source)
- [ ] Add items: search product → available stock at source shown
- [ ] Enter transfer quantity → cannot exceed available stock at source
- [ ] Add notes → saves with transfer
- [ ] Transfer saves as Pending

### Role Restriction
- [ ] As POS Operator / Warehouse: Shop-to-Shop transfer is blocked
- [ ] As Admin / Officer: Shop-to-Shop transfer is allowed

### Complete Transfer
- [ ] Open a Pending transfer → "Complete" button
- [ ] Complete → stock deducted from source location
- [ ] Stock added to destination location
- [ ] Both location inventories update in Inventory page

### Cancel Transfer
- [ ] Cancel a Pending transfer → stock is NOT moved
- [ ] Status shows Cancelled

---

## 13. Expenses / Day Transactions

### Expenses Tab

#### List View
- [ ] Expenses list loads with category, description, amount, date
- [ ] Search for an expense → filters correctly

#### Create Expense
- [ ] Click Add Expense → form opens
- [ ] Select category from predefined list
- [ ] Enter description, amount, payment method, location
- [ ] Submit with empty required fields → validation error
- [ ] Valid expense saves → appears in list with correct totals
- [ ] Total expenses figure updates

#### Edit Expense
- [ ] Click Edit on an expense → form opens pre-filled
- [ ] Change amount or category → save → list reflects change

#### Delete Expense
- [ ] Click Delete on an expense → confirmation prompt
- [ ] Confirm → expense removed, total updates

### Other Income Tab
- [ ] Income list loads correctly
- [ ] Create income: source = Supplier Refund / Credit Note / Discount Received / Other → saves
- [ ] Selecting "Supplier Refund" → optional supplier field appears
- [ ] Delete income entry → entry removed with confirmation

### Day End Tab
- [ ] Daily Finance Report loads for today by default
- [ ] Shows revenue by payment method
- [ ] Shows expense breakdown
- [ ] Shows cash position (cash in − cash out)
- [ ] Shows pending/partial payments for the day
- [ ] Changing the date shows that day's data

---

## 14. Salespeople

### List View
- [ ] Salespeople list loads with name, status, invoice count, revenue
- [ ] Active and Inactive salespeople shown with status indicator
- [ ] Search by name → filters correctly

### Create Salesperson
- [ ] Click Add Salesperson → form/input appears
- [ ] Enter name → salesperson saves and appears in list
- [ ] New salesperson is available in POS salesperson dropdown

### Edit Salesperson
- [ ] Click edit/rename → change name → saves correctly

### Toggle Status
- [ ] Toggle Active → Inactive → salesperson no longer appears in POS dropdown
- [ ] Toggle Inactive → Active → salesperson returns to POS dropdown

### Performance Metrics
- [ ] Open salesperson detail → invoice count, total revenue shown
- [ ] Filter by **Day** → shows today's stats
- [ ] Filter by **Month** → shows this month's stats
- [ ] Filter by **All Time** → shows all-time stats
- [ ] Bar chart renders without error
- [ ] Invoice list shows: customer, total, payment status, date

---

## 15. Reports

> Test each report by selecting a date range that includes known data.

### Financial Reports
- [ ] **Profit & Loss**: Loads for selected period, shows revenue, cost of goods, gross profit, expenses, net profit
- [ ] **Sales Profit**: Per-invoice profit calculated correctly
- [ ] **Batch Profit**: Per-received-batch profit shown
- [ ] **Expenses**: Expense breakdown by category for period
- [ ] **Cash Flow**: Cash in/out by day for period
- [ ] **Daily Finance**: Day-by-day reconciliation for selected date

### Inventory Reports
- [ ] **Current Stock**: All products with current stock levels
- [ ] **Stock Valuation**: Inventory value at cost price
- [ ] **Low Stock**: Items below reorder threshold shown
- [ ] **Stock Adjustment**: All adjustments in the period listed
- [ ] **Stock Aging**: Receipt dates and age of current batches
- [ ] **Inventory Movement**: Inflows and outflows per product per period

### Sales Reports
- [ ] **By Product**: Sales volume and revenue per product for period
- [ ] **By Customer**: Each customer's purchase total for period
- [ ] **By Salesperson**: Revenue per salesperson for period
- [ ] **Wholesale vs Retail**: Comparison of modes for period
- [ ] **Invoice Report**: Full invoice listing for period

### Customer Reports
- [ ] **Customer Ledger**: Invoice and payment history per customer
- [ ] **Credit Report**: Credit limit vs outstanding per customer
- [ ] **AR Aging**: Accounts receivable aging (current, 30, 60, 90+ days)

### Supplier Reports
- [ ] **Purchase History**: Purchase orders per supplier for period
- [ ] **Payables**: Outstanding amounts owed to each supplier

### Other Reports
- [ ] **Returns**: Sales returns listing for period
- [ ] **Damage**: Damage records for period
- [ ] **Fast/Slow Moving**: Products ranked by sales velocity
- [ ] **Dead Stock**: Products with no sales movement in period

### Report Features
- [ ] Date range picker works — changing dates updates report data
- [ ] Export / Print button works on each report
- [ ] KPI cards at top of each report show correct totals
- [ ] Tables are paginated or scrollable with large datasets
- [ ] Charts render without error
- [ ] Empty state shown if no data for the selected period

---

## 16. Cashier Page

- [ ] Page loads for today's date by default
- [ ] Change date → page reloads data for that date
- [ ] **Payment Summary** shows totals per payment method (Cash, Card, Online, Bank Transfer, Cheque)
- [ ] **Bank-wise Breakdown**: Online payments grouped by bank name
- [ ] Payment counts per method are correct
- [ ] **Partial Invoices** section lists unpaid or partially paid invoices for the day
- [ ] **Expenses** section shows today's expense entries
- [ ] **Returns** section shows today's return transactions
- [ ] **Daily Finance Report** embedded at bottom renders correctly
- [ ] All totals match data in Reports → Daily Finance for the same date

---

## 17. Bulk Import

### Upload Step
- [ ] Drag-and-drop an Excel file onto the upload zone → file is accepted
- [ ] Click "Browse" → file picker opens → select Excel file → file loaded
- [ ] Uploading a non-Excel file → error or rejection message shown

### Preview Step
- [ ] After upload, rows are classified:
  - **New** (green): Products that don't exist yet
  - **Update** (blue): Products that exist and will be updated
  - **Duplicate** (yellow): Rows repeated within the file
  - **Error** (red): Rows with missing required data
- [ ] Classification legend is visible
- [ ] Summary stats show: total rows, new, updates, duplicates, errors
- [ ] Error rows show specific error messages
- [ ] Shipment code field is fillable
- [ ] Supplier name field is fillable

### Confirm Step
- [ ] Click Confirm Import → products are created/updated in database
- [ ] Success message shows import summary (count of created, updated)
- [ ] Newly imported products appear on the Products page
- [ ] Option to import another batch resets the form

### Rollback Feature
- [ ] After a previous import: "Rollback" option is available
- [ ] Select a past shipment from the dropdown
- [ ] Rollback confirmation prompt shows consequences
- [ ] Confirm rollback → products/stock from that shipment are reversed
- [ ] Rolled back products/stock no longer appear in Products/Inventory

### Sample Template
- [ ] Download sample template button works
- [ ] Downloaded file opens correctly in Excel

---

## 18. Cross-Cutting Features

### Credit Limit Enforcement
- [ ] Customer at credit limit: POS checkout blocked or warning shown
- [ ] Customer with available credit: checkout proceeds normally
- [ ] After a sale on credit: available credit decreases
- [ ] After a payment: available credit increases

### Loyalty Points
- [ ] Make a sale: customer earns 1 point per LKR 100
- [ ] Customer's loyalty balance increases on their profile
- [ ] At POS: redeem points → discount applied (LKR 1 per point)
- [ ] After redemption: redeemed count increases on customer profile

### Stock Consistency
- [ ] Create a POS sale → stock decreases in Inventory
- [ ] Receive a purchase → stock increases in Inventory
- [ ] Complete a sales return → returned stock restores in Inventory
- [ ] Complete a stock transfer → source decreases, destination increases

### Approval Workflows
- [ ] POS discount > threshold: approval PIN prompt appears
- [ ] Wrong PIN: discount not applied
- [ ] Correct admin/accountant PIN: discount applies
- [ ] Purchase discount: pending approval item appears in Purchase detail
- [ ] Admin approves: discount finalizes

### Multi-Payment Splitting
- [ ] POS: add two payment lines (cash + card) summing to exact total → checkout allowed
- [ ] POS: split payment less than total → remainder recorded as credit/outstanding
- [ ] Payment methods saved correctly per invoice

### Printing & PDF
- [ ] POS receipt prints/generates PDF after sale
- [ ] Receipt shows: store name, items, quantities, prices, discounts, total, payment method, date
- [ ] Purchase bill print generates correctly
- [ ] Supplier return document prints correctly

### Toast Notifications
- [ ] Success actions show a green toast message
- [ ] Error actions show a red toast message
- [ ] Toast disappears automatically after a few seconds

### Loading & Error States
- [ ] All list pages show skeleton loaders while fetching
- [ ] If a fetch fails: error message shown with a retry option
- [ ] Retry button reloads the data successfully

### Pagination
- [ ] Large lists (products, invoices, reports) have pagination or infinite scroll
- [ ] Navigating between pages works correctly

---

## Notes / Issues Found

| # | Page | Issue Description | Status |
|---|------|-------------------|--------|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |

---

*Last Updated: 2026-06-15*
