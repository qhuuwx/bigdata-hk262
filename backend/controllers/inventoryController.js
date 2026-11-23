/**
 * Inventory Controller
 * Handles cumulative stock streaming (REST + SSE), top 10 alerts, and test reset.
 */

const { inventoryService } = require('../services');
const { CONSTANTS } = require('../config');

class InventoryController {
  /**
   * GET /api/inventory/stream
   * Classifies a random batch of 50 items and increments module-level cumulative state.
   */
  getInventoryStream(req, res) {
    const cumulativeState = inventoryService.processStreamBatch(CONSTANTS.INVENTORY.STREAM_BATCH_SIZE);
    res.status(CONSTANTS.HTTP_STATUS.OK).json(cumulativeState);
  }

  /**
   * GET /api/inventory/stream/events
   * Pushes 50-record cumulative inventory state updates via Server-Sent Events (SSE)
   * every 2000ms ('event: inventory') sharing atomic server RAM state.
   */
  streamInventoryEvents(req, res) {
    res.writeHead(CONSTANTS.HTTP_STATUS.OK, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    const pushInventory = () => {
      if (res.writableEnded || res.destroyed) return;
      const cumulativeState = inventoryService.processStreamBatch(CONSTANTS.INVENTORY.STREAM_BATCH_SIZE);
      res.write(`event: inventory\ndata: ${JSON.stringify(cumulativeState)}\n\n`);
    };

    // Emit initial cumulative batch immediately
    pushInventory();

    const streamInterval = setInterval(pushInventory, CONSTANTS.STREAM.POLLING_INTERVAL_MS);
    const heartbeatInterval = setInterval(() => {
      if (!res.writableEnded && !res.destroyed) {
        res.write(': ping\n\n');
      }
    }, 15000);

    if (streamInterval.unref) streamInterval.unref();
    if (heartbeatInterval.unref) heartbeatInterval.unref();

    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(streamInterval);
      clearInterval(heartbeatInterval);
    };

    req.on('close', cleanup);
    res.on('close', cleanup);
  }

  /**
   * GET /api/inventory/alerts
   * Returns top 10 stock alerts prioritized by Low Stock then Overstock.
   */
  getInventoryAlerts(req, res) {
    const alerts = inventoryService.getAlerts();
    res.status(CONSTANTS.HTTP_STATUS.OK).json(alerts);
  }

  /**
   * POST /api/inventory/reset
   * Resets the cumulative state (used by test suites and UI reset button).
   */
  resetInventory(req, res) {
    const state = inventoryService.resetCumulativeState();
    res.status(CONSTANTS.HTTP_STATUS.OK).json({
      status: 'reset',
      cumulativeState: state
    });
  }
}

module.exports = new InventoryController();
