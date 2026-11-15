/**
 * Inventory Stock Classification Algorithm
 * Pure function: Zero external imports.
 * 
 * Classifies an inventory item based on its current stock level relative to
 * average daily sales over the last 30 days:
 * 
 * - Healthy: Qty on hand >= avgDailySales * 14 (or avgDailySales <= 0)
 * - Low Stock: Qty on hand > 0 && Qty on hand < avgDailySales * 14 (or qty <= 0 when sales > 0)
 * - Overstock: Qty on hand >= avgDailySales * 60
 * 
 * @param {number} qtyOnHand - Current stock quantity
 * @param {number} avgDailySales - Average sales per day over last 30 days
 * @returns {'healthy' | 'low' | 'over'} Status category
 */
function classifyInventory(qtyOnHand, avgDailySales) {
  const qty = Number(qtyOnHand) || 0;
  const sales = Number(avgDailySales) || 0;

  // If no sales history, default to healthy
  if (sales <= 0) {
    return 'healthy';
  }

  // Overstock: covers more than 60 days of sales
  if (qty >= sales * 60) {
    return 'over';
  }

  // Low Stock: covers less than 14 days of sales
  if (qty < sales * 14) {
    return 'low';
  }

  // Healthy: covers at least 14 days of sales
  return 'healthy';
}

module.exports = {
  classifyInventory
};
