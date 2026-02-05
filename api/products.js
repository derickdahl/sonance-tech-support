// Vercel Serverless Function - Product lookup
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Load all products at cold start
let products = {};

function loadProducts() {
  if (Object.keys(products).length > 0) return products;
  
  const productsDir = join(process.cwd(), 'products');
  try {
    const skus = readdirSync(productsDir);
    for (const sku of skus) {
      const knowledgePath = join(productsDir, sku, 'knowledge.json');
      try {
        const data = JSON.parse(readFileSync(knowledgePath, 'utf-8'));
        products[sku] = data;
      } catch (e) {
        console.error(`Failed to load ${sku}:`, e.message);
      }
    }
  } catch (e) {
    console.error('Failed to read products directory:', e.message);
  }
  return products;
}

// Find product by SKU or model name
function findProduct(query) {
  const prods = loadProducts();
  const q = query.toLowerCase().trim();
  
  // Direct SKU match
  if (prods[q]) return prods[q];
  
  // Search by model name
  for (const [sku, data] of Object.entries(prods)) {
    const model = data.product?.model?.toLowerCase() || '';
    const fullName = data.product?.full_name?.toLowerCase() || '';
    if (model.includes(q) || q.includes(model) || fullName.includes(q)) {
      return data;
    }
  }
  return null;
}

export default function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { sku, model, query } = req.method === 'POST' ? req.body : req.query;
  const searchTerm = sku || model || query;
  
  if (!searchTerm) {
    // Return list of all products
    const prods = loadProducts();
    const list = Object.entries(prods).map(([sku, data]) => ({
      sku,
      model: data.product?.model,
      name: data.product?.full_name,
      category: data.product?.category
    }));
    return res.json({ products: list, count: list.length });
  }
  
  const product = findProduct(searchTerm);
  if (!product) {
    return res.status(404).json({ error: 'Product not found', query: searchTerm });
  }
  
  return res.json(product);
}
