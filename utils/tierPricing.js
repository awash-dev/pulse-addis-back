/**
 * Tier Pricing Engine
 * 
 * Calculates the correct unit price for a product based on quantity
 * and the product's tier pricing configuration.
 *
 * tierPricing JSON format: [{ minQty: number, price: number }, ...]
 * Tiers MUST be sorted ascending by minQty.
 *
 * @param {object} product - Product record with wholesalePrice and tierPricing
 * @param {number} quantity - Requested quantity
 * @returns {{ unitPrice: number, totalPrice: number, tierApplied: boolean }}
 */
const calculatePrice = (product, quantity) => {
  const basePrice = parseFloat(product.wholesalePrice || product.price || 0);
  let unitPrice = basePrice;
  let tierApplied = false;

  if (product.tierPricing && Array.isArray(product.tierPricing) && product.tierPricing.length > 0) {
    // Sort tiers descending by minQty so we find the highest qualifying tier first
    const sortedTiers = [...product.tierPricing].sort((a, b) => b.minQty - a.minQty);

    for (const tier of sortedTiers) {
      if (quantity >= tier.minQty) {
        unitPrice = parseFloat(tier.price);
        tierApplied = true;
        break;
      }
    }
  }

  return {
    unitPrice: Math.round(unitPrice * 100) / 100,
    totalPrice: Math.round(unitPrice * quantity * 100) / 100,
    tierApplied,
  };
};

/**
 * Validates that a quantity meets the product's MOQ and case quantity constraints.
 *
 * @param {object} product - Product record
 * @param {number} quantity - Requested quantity
 * @returns {{ valid: boolean, error?: string, correctedQty?: number }}
 */
const validateMOQ = (product, quantity) => {
  const moq = product.minimumOrderQuantity || 1;
  const caseQty = product.caseQuantity || null;

  if (quantity < moq) {
    return {
      valid: false,
      error: `Minimum order quantity is ${moq}. Requested: ${quantity}.`,
      correctedQty: moq,
    };
  }

  if (caseQty && caseQty > 1 && quantity % caseQty !== 0) {
    const corrected = Math.ceil(quantity / caseQty) * caseQty;
    return {
      valid: false,
      error: `Quantity must be a multiple of case quantity (${caseQty}). Suggested: ${corrected}.`,
      correctedQty: corrected,
    };
  }

  return { valid: true };
};

module.exports = { calculatePrice, validateMOQ };
