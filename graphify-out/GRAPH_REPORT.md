# Graph Report - Diaster-Wholesale  (2026-06-24)

## Corpus Check
- 105 files · ~4,473,937 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 544 nodes · 726 edges · 23 communities detected
- Extraction: 81% EXTRACTED · 19% INFERRED · 0% AMBIGUOUS · INFERRED: 139 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]

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
Cohesion: 0.08
Nodes (23): clearSyncedSales(), getPendingCount(), getPendingSales(), markSynced(), openDB(), saveOfflineSale(), syncPendingSales(), addToCart() (+15 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (16): load(), load(), canCancelSales(), cn(), handleCancel(), load(), load(), load() (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (21): handleAddCost(), handleCancel(), handleDeleteCost(), handleFinalize(), handleOrder(), handleReceive(), handleResolveApproval(), handleSaveItems() (+13 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (21): archiveSupplier(), createSupplier(), deleteSupplierPayment(), getPendingApprovals(), getSupplierLedger(), getSuppliers(), normalizePurchaseTotal(), recordSupplierPayment() (+13 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (14): handleRefresh(), load(), loadData(), handlePeriodChange(), handleRefresh(), loadData(), getCurrentStockReport(), getCurrentStockReportByLocation() (+6 more)

### Community 5 - "Community 5"
Cohesion: 0.13
Nodes (19): handleDelete(), handleSaveExpense(), handleSaveIncome(), load(), showToast(), createExpense(), deleteExpense(), getCompanyCashBalance() (+11 more)

### Community 6 - "Community 6"
Cohesion: 0.1
Nodes (18): load(), archiveProduct(), checkDuplicate(), createProduct(), deleteProduct(), generateItemCode(), getArchivedProducts(), getProducts() (+10 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (18): handleChequeAction(), handleRecordPayment(), handleSaveChanges(), loadData(), archiveCustomer(), completeCheque(), createCustomer(), depositCheque() (+10 more)

### Community 8 - "Community 8"
Cohesion: 0.1
Nodes (13): closeAdjustModal(), fetchInventory(), handleAdjustSubmit(), loadLedger(), openHistory(), getInventory(), getInventoryByLocation(), getPosShopCatalog() (+5 more)

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (14): getMovementRates(), createPurchase(), deletePurchase(), deletePurchaseDependents(), forceDeletePurchase(), getPurchases(), handleCreate(), handleDelete() (+6 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (12): runAggregationAndUpload(), startMetricsScheduler(), AppOfflineDatabase, generateUUID(), getOrCreateDeviceId(), logMetricEvent(), handleDelLsKey(), handleForceSync() (+4 more)

### Community 11 - "Community 11"
Cohesion: 0.13
Nodes (9): handleConfirm(), handleDrop(), handleFile(), handleFileInput(), handleRollback(), classifyRows(), confirmImport(), parseExcelFile() (+1 more)

### Community 12 - "Community 12"
Cohesion: 0.2
Nodes (13): cancelSupplierReturn(), completeSupplierReturn(), createSupplierReturn(), generateReturnReference(), getSupplierReturnById(), getSupplierReturns(), async(), handleComplete() (+5 more)

### Community 13 - "Community 13"
Cohesion: 0.19
Nodes (12): canApprove(), confirmComplete(), handleComplete(), handleCreate(), load(), openDetail(), showToast(), completeStockTransfer() (+4 more)

### Community 14 - "Community 14"
Cohesion: 0.17
Nodes (11): handleCreate(), handleRename(), handleToggleActive(), loadInvoices(), loadPeople(), showToast(), addSalesperson(), getAllSalespeople() (+3 more)

### Community 15 - "Community 15"
Cohesion: 0.19
Nodes (6): completeReturn(), deductStock(), restoreStock(), showToast(), submitReturn(), undoReturn()

### Community 16 - "Community 16"
Cohesion: 0.26
Nodes (8): DashboardRoute(), ProtectedRoute(), can(), canAny(), getCurrentRole(), getRolePin(), usePermissions(), handleApproveDiscount()

### Community 17 - "Community 17"
Cohesion: 0.36
Nodes (5): applyPayload(), emitStoreUpdate(), ensureGlobalSubscription(), getUpdater(), updateStore()

### Community 18 - "Community 18"
Cohesion: 0.6
Nodes (5): checkForUpdates(), configureAutoUpdater(), createMainWindow(), resolveIcon(), sendUpdaterStatus()

### Community 23 - "Community 23"
Cohesion: 0.67
Nodes (2): mapInvoice(), processInvoiceReturn()

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (2): ARAgingReport(), bucketColor()

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (2): fmt(), KPI()

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (2): ageBucket(), load()

## Knowledge Gaps
- **Thin community `Community 23`** (4 nodes): `mapInvoice()`, `processInvoiceReturn()`, `searchReturnableInvoices()`, `returnsService.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (3 nodes): `ARAgingReport()`, `bucketColor()`, `ARAgingReport.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (3 nodes): `fmt()`, `KPI()`, `DailyFinanceReport.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (3 nodes): `StockAgingReport.tsx`, `ageBucket()`, `load()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getProducts()` connect `Community 6` to `Community 2`, `Community 8`, `Community 9`, `Community 11`, `Community 12`, `Community 13`?**
  _High betweenness centrality (0.237) - this node is a cross-community bridge._
- **Why does `getReportDateRange()` connect `Community 1` to `Community 8`, `Community 6`?**
  _High betweenness centrality (0.207) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `load()` (e.g. with `getPurchaseById()` and `getPendingApprovals()`) actually correct?**
  _`load()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `getReportDateRange()` (e.g. with `load()` and `load()`) actually correct?**
  _`getReportDateRange()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `load()` (e.g. with `getSupplierReturns()` and `getSuppliers()`) actually correct?**
  _`load()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `load()` (e.g. with `getExpenses()` and `getOtherIncome()`) actually correct?**
  _`load()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._