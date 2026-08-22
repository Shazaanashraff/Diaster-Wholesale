# Graph Report - Diaster-Wholesale  (2026-08-23)

## Corpus Check
- 114 files · ~4,490,116 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 587 nodes · 773 edges · 22 communities detected
- Extraction: 81% EXTRACTED · 19% INFERRED · 0% AMBIGUOUS · INFERRED: 146 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]

## God Nodes (most connected - your core abstractions)
1. `load()` - 12 edges
2. `showToast()` - 11 edges
3. `getReportDateRange()` - 11 edges
4. `load()` - 10 edges
5. `load()` - 9 edges
6. `load()` - 9 edges
7. `getProducts()` - 9 edges
8. `handleChequeAction()` - 8 edges
9. `loadPanelData()` - 8 edges
10. `load()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `load()` --calls--> `getPendingApprovals()`  [INFERRED]
  src\pages\PurchaseDetailPage.tsx → src\services\supplierService.ts
- `handleResolveApproval()` --calls--> `resolveDiscountApproval()`  [INFERRED]
  src\pages\PurchaseDetailPage.tsx → src\services\supplierService.ts
- `handleFile()` --calls--> `parseExcelFile()`  [INFERRED]
  src\pages\BulkImportPage.tsx → src\services\importService.ts
- `loadData()` --calls--> `getCustomerById()`  [INFERRED]
  src\pages\CustomerDetailPage.tsx → src\services\customerService.ts
- `loadData()` --calls--> `getCustomerLedger()`  [INFERRED]
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
Cohesion: 0.1
Nodes (26): handleAddCost(), handleCancel(), handleDeleteCost(), handleFinalize(), handleOrder(), handleReceive(), handleResolveApproval(), handleSaveItems() (+18 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (23): handleAdjustBalance(), handleChequeAction(), handleRecordPayment(), handleSaveChanges(), loadData(), adjustCustomerOutstandingManual(), archiveCustomer(), completeCheque() (+15 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (21): archiveSupplier(), createSupplier(), deleteSupplierPayment(), getPendingApprovals(), getSupplierLedger(), getSuppliers(), normalizePurchaseTotal(), recordSupplierPayment() (+13 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (10): runAggregationAndUpload(), startMetricsScheduler(), handleDelLsKey(), handleForceSync(), handleSetLsKey(), loadAuditData(), loadLocalStorageKeys(), handleSave() (+2 more)

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (14): handleRefresh(), load(), loadData(), handlePeriodChange(), handleRefresh(), loadData(), getCurrentStockReport(), getCurrentStockReportByLocation() (+6 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (11): load(), load(), cn(), load(), load(), load(), ProfitLossReport(), load() (+3 more)

### Community 9 - "Community 9"
Cohesion: 0.1
Nodes (13): closeAdjustModal(), fetchInventory(), handleAdjustSubmit(), loadLedger(), openHistory(), getInventory(), getInventoryByLocation(), getPosShopCatalog() (+5 more)

### Community 10 - "Community 10"
Cohesion: 0.13
Nodes (13): DashboardRoute(), ProtectedRoute(), canCancelSales(), handleCancel(), isAdmin(), load(), can(), canAny() (+5 more)

### Community 11 - "Community 11"
Cohesion: 0.15
Nodes (10): getMovementRates(), handleCreate(), handleDelete(), handleQuickCreateProduct(), load(), loadPanelData(), openPanel(), setItem() (+2 more)

### Community 12 - "Community 12"
Cohesion: 0.19
Nodes (12): canApprove(), confirmComplete(), handleComplete(), handleCreate(), load(), openDetail(), showToast(), completeStockTransfer() (+4 more)

### Community 13 - "Community 13"
Cohesion: 0.17
Nodes (11): handleCreate(), handleRename(), handleToggleActive(), loadInvoices(), loadPeople(), showToast(), addSalesperson(), getAllSalespeople() (+3 more)

### Community 14 - "Community 14"
Cohesion: 0.19
Nodes (6): completeReturn(), deductStock(), restoreStock(), showToast(), submitReturn(), undoReturn()

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (9): AppOfflineDatabase, generateUUID(), getOrCreateDeviceId(), logMetricEvent(), cn(), fmt(), handleOpeningBlur(), KPI() (+1 more)

### Community 16 - "Community 16"
Cohesion: 0.31
Nodes (6): cancel(), doReset(), runBroad(), runModule(), runModuleE2E(), runner()

### Community 17 - "Community 17"
Cohesion: 0.36
Nodes (5): checkForUpdates(), configureAutoUpdater(), createMainWindow(), resolveIcon(), sendUpdaterStatus()

### Community 18 - "Community 18"
Cohesion: 0.36
Nodes (5): applyPayload(), emitStoreUpdate(), ensureGlobalSubscription(), getUpdater(), updateStore()

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (2): ARAgingReport(), bucketColor()

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (2): ageBucket(), load()

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (2): findTestFiles(), normalise()

## Knowledge Gaps
- **Thin community `Community 25`** (3 nodes): `ARAgingReport()`, `bucketColor()`, `ARAgingReport.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (3 nodes): `StockAgingReport.tsx`, `ageBucket()`, `load()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (3 nodes): `test-groups.test.ts`, `findTestFiles()`, `normalise()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getProducts()` connect `Community 0` to `Community 1`, `Community 3`, `Community 9`, `Community 11`, `Community 12`?**
  _High betweenness centrality (0.241) - this node is a cross-community bridge._
- **Why does `getReportDateRange()` connect `Community 8` to `Community 0`, `Community 9`, `Community 10`?**
  _High betweenness centrality (0.203) - this node is a cross-community bridge._
- **Why does `load()` connect `Community 10` to `Community 8`?**
  _High betweenness centrality (0.160) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `load()` (e.g. with `getPurchaseById()` and `getPendingApprovals()`) actually correct?**
  _`load()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `getReportDateRange()` (e.g. with `load()` and `load()`) actually correct?**
  _`getReportDateRange()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `load()` (e.g. with `getSupplierReturns()` and `getSuppliers()`) actually correct?**
  _`load()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `load()` (e.g. with `getExpenses()` and `getOtherIncome()`) actually correct?**
  _`load()` has 4 INFERRED edges - model-reasoned connections that need verification._