# Graph Report - Diaster-Wholesale  (2026-06-27)

## Corpus Check
- 105 files · ~4,474,801 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 546 nodes · 729 edges · 20 communities detected
- Extraction: 81% EXTRACTED · 19% INFERRED · 0% AMBIGUOUS · INFERRED: 140 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]

## God Nodes (most connected - your core abstractions)
1. `load()` - 12 edges
2. `getReportDateRange()` - 12 edges
3. `showToast()` - 11 edges
4. `load()` - 10 edges
5. `load()` - 9 edges
6. `load()` - 9 edges
7. `getProducts()` - 9 edges
8. `loadPanelData()` - 8 edges
9. `load()` - 8 edges
10. `showToast()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `load()` --calls--> `getPendingApprovals()`  [INFERRED]
  src\pages\PurchaseDetailPage.tsx → src\services\supplierService.ts
- `handleResolveApproval()` --calls--> `resolveDiscountApproval()`  [INFERRED]
  src\pages\PurchaseDetailPage.tsx → src\services\supplierService.ts
- `canCancelSales()` --calls--> `getCurrentRole()`  [INFERRED]
  src\pages\reports\DailySalesReport.tsx → src\utils\permissions.ts
- `handleFile()` --calls--> `parseExcelFile()`  [INFERRED]
  src\pages\BulkImportPage.tsx → src\services\importService.ts
- `loadData()` --calls--> `getCustomerById()`  [INFERRED]
  src\pages\CustomerDetailPage.tsx → src\services\customerService.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (27): handleConfirm(), handleDrop(), handleFile(), handleFileInput(), handleRollback(), load(), classifyRows(), confirmImport() (+19 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (31): handleDelete(), handleSaveExpense(), handleSaveIncome(), load(), showToast(), createExpense(), deleteExpense(), getCompanyCashBalance() (+23 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (23): clearSyncedSales(), getPendingCount(), getPendingSales(), markSynced(), openDB(), saveOfflineSale(), syncPendingSales(), addToCart() (+15 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (16): load(), load(), canCancelSales(), cn(), handleCancel(), load(), load(), load() (+8 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (21): handleAddCost(), handleCancel(), handleDeleteCost(), handleFinalize(), handleOrder(), handleReceive(), handleResolveApproval(), handleSaveItems() (+13 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (21): archiveSupplier(), createSupplier(), deleteSupplierPayment(), getPendingApprovals(), getSupplierLedger(), getSuppliers(), normalizePurchaseTotal(), recordSupplierPayment() (+13 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (14): handleRefresh(), load(), loadData(), handlePeriodChange(), handleRefresh(), loadData(), getCurrentStockReport(), getCurrentStockReportByLocation() (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (18): handleChequeAction(), handleRecordPayment(), handleSaveChanges(), loadData(), archiveCustomer(), completeCheque(), createCustomer(), depositCheque() (+10 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (16): runAggregationAndUpload(), startMetricsScheduler(), AppOfflineDatabase, generateUUID(), getOrCreateDeviceId(), logMetricEvent(), cn(), fmt() (+8 more)

### Community 9 - "Community 9"
Cohesion: 0.1
Nodes (13): closeAdjustModal(), fetchInventory(), handleAdjustSubmit(), loadLedger(), openHistory(), getInventory(), getInventoryByLocation(), getPosShopCatalog() (+5 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (15): getMovementRates(), createPurchase(), deletePurchase(), deletePurchaseDependents(), forceDeletePurchase(), getPurchases(), handleCreate(), handleDelete() (+7 more)

### Community 11 - "Community 11"
Cohesion: 0.19
Nodes (12): canApprove(), confirmComplete(), handleComplete(), handleCreate(), load(), openDetail(), showToast(), completeStockTransfer() (+4 more)

### Community 12 - "Community 12"
Cohesion: 0.17
Nodes (11): handleCreate(), handleRename(), handleToggleActive(), loadInvoices(), loadPeople(), showToast(), addSalesperson(), getAllSalespeople() (+3 more)

### Community 13 - "Community 13"
Cohesion: 0.19
Nodes (6): completeReturn(), deductStock(), restoreStock(), showToast(), submitReturn(), undoReturn()

### Community 14 - "Community 14"
Cohesion: 0.26
Nodes (8): DashboardRoute(), ProtectedRoute(), can(), canAny(), getCurrentRole(), getRolePin(), usePermissions(), handleApproveDiscount()

### Community 15 - "Community 15"
Cohesion: 0.36
Nodes (5): applyPayload(), emitStoreUpdate(), ensureGlobalSubscription(), getUpdater(), updateStore()

### Community 16 - "Community 16"
Cohesion: 0.53
Nodes (5): checkForUpdates(), configureAutoUpdater(), createMainWindow(), resolveIcon(), sendUpdaterStatus()

### Community 21 - "Community 21"
Cohesion: 0.67
Nodes (2): mapInvoice(), processInvoiceReturn()

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (2): ARAgingReport(), bucketColor()

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (2): ageBucket(), load()

## Knowledge Gaps
- **Thin community `Community 21`** (4 nodes): `mapInvoice()`, `processInvoiceReturn()`, `searchReturnableInvoices()`, `returnsService.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (3 nodes): `ARAgingReport()`, `bucketColor()`, `ARAgingReport.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (3 nodes): `StockAgingReport.tsx`, `ageBucket()`, `load()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getProducts()` connect `Community 0` to `Community 1`, `Community 4`, `Community 9`, `Community 10`, `Community 11`?**
  _High betweenness centrality (0.243) - this node is a cross-community bridge._
- **Why does `getReportDateRange()` connect `Community 3` to `Community 0`, `Community 9`?**
  _High betweenness centrality (0.210) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `load()` (e.g. with `getPurchaseById()` and `getPendingApprovals()`) actually correct?**
  _`load()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `getReportDateRange()` (e.g. with `load()` and `load()`) actually correct?**
  _`getReportDateRange()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `load()` (e.g. with `getSupplierReturns()` and `getSuppliers()`) actually correct?**
  _`load()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `load()` (e.g. with `getExpenses()` and `getOtherIncome()`) actually correct?**
  _`load()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._