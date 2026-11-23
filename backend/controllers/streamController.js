/**
 * Stream Controller
 * Handles live transaction streaming endpoints (REST polling + Server-Sent Events).
 */

const { salesStreamService } = require('../services');
const { CONSTANTS } = require('../config');

class StreamController {
  /**
   * GET /api/stream/sales
   * Returns a sample of 20 random sales transactions.
   */
  getSalesStream(req, res) {
    const streamData = salesStreamService.getSalesStream(CONSTANTS.STREAM.SALES_BATCH_SIZE);
    res.status(CONSTANTS.HTTP_STATUS.OK).json(streamData);
  }

  /**
   * GET /api/stream/sales/events
   * Pushes 20-row sales batches via Server-Sent Events (SSE) every 2000ms ('event: batch')
   * with heartbeat comments (': ping\n\n') and automatic disconnect cleanup.
   */
  streamSalesEvents(req, res) {
    res.writeHead(CONSTANTS.HTTP_STATUS.OK, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    const pushBatch = () => {
      if (res.writableEnded || res.destroyed) return;
      const batch = salesStreamService.getSalesStream(CONSTANTS.STREAM.SALES_BATCH_SIZE);
      res.write(`event: batch\ndata: ${JSON.stringify(batch)}\n\n`);
    };

    // Emit initial batch immediately
    pushBatch();

    const batchInterval = setInterval(pushBatch, CONSTANTS.STREAM.POLLING_INTERVAL_MS);
    const heartbeatInterval = setInterval(() => {
      if (!res.writableEnded && !res.destroyed) {
        res.write(': ping\n\n');
      }
    }, 15000);

    if (batchInterval.unref) batchInterval.unref();
    if (heartbeatInterval.unref) heartbeatInterval.unref();

    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(batchInterval);
      clearInterval(heartbeatInterval);
    };

    req.on('close', cleanup);
    res.on('close', cleanup);
  }
}

module.exports = new StreamController();
