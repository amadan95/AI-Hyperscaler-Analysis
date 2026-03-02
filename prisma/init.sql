-- CreateTable
CREATE TABLE "Lab" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sourceAccess" TEXT NOT NULL DEFAULT 'official',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "url" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "effectiveTradingDate" DATETIME,
    "eventType" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "sourceTier" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriceBar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "open" REAL NOT NULL,
    "high" REAL NOT NULL,
    "low" REAL NOT NULL,
    "close" REAL NOT NULL,
    "volume" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EventImpact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "window" INTEGER NOT NULL,
    "rawReturn" REAL NOT NULL,
    "abnormalReturn" REAL NOT NULL,
    "car" REAL NOT NULL,
    "pValue" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventImpact_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CorrelationMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "lagDays" INTEGER NOT NULL,
    "correlation" REAL NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CorrelationMetric_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SourceStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceTier" TEXT NOT NULL,
    "lastSuccessAt" DATETIME,
    "lastFailureAt" DATETIME,
    "lastRunAt" DATETIME,
    "lastError" TEXT,
    "etag" TEXT,
    "lastModified" TEXT,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SourceStatus_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "fromDate" DATETIME NOT NULL,
    "toDate" DATETIME NOT NULL,
    "success" BOOLEAN NOT NULL,
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_hash_key" ON "Event"("hash");

-- CreateIndex
CREATE INDEX "Event_publishedAt_idx" ON "Event"("publishedAt");

-- CreateIndex
CREATE INDEX "Event_effectiveTradingDate_idx" ON "Event"("effectiveTradingDate");

-- CreateIndex
CREATE INDEX "Event_confidence_idx" ON "Event"("confidence");

-- CreateIndex
CREATE INDEX "Event_sourceTier_idx" ON "Event"("sourceTier");

-- CreateIndex
CREATE UNIQUE INDEX "Event_labId_canonicalUrl_key" ON "Event"("labId", "canonicalUrl");

-- CreateIndex
CREATE INDEX "PriceBar_date_idx" ON "PriceBar"("date");

-- CreateIndex
CREATE UNIQUE INDEX "PriceBar_ticker_date_key" ON "PriceBar"("ticker", "date");

-- CreateIndex
CREATE INDEX "EventImpact_ticker_idx" ON "EventImpact"("ticker");

-- CreateIndex
CREATE INDEX "EventImpact_window_idx" ON "EventImpact"("window");

-- CreateIndex
CREATE UNIQUE INDEX "EventImpact_eventId_ticker_window_key" ON "EventImpact"("eventId", "ticker", "window");

-- CreateIndex
CREATE INDEX "CorrelationMetric_ticker_idx" ON "CorrelationMetric"("ticker");

-- CreateIndex
CREATE INDEX "CorrelationMetric_lagDays_idx" ON "CorrelationMetric"("lagDays");

-- CreateIndex
CREATE UNIQUE INDEX "CorrelationMetric_labId_ticker_lagDays_key" ON "CorrelationMetric"("labId", "ticker", "lagDays");

-- CreateIndex
CREATE UNIQUE INDEX "SourceStatus_labId_sourceName_key" ON "SourceStatus"("labId", "sourceName");

