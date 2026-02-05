// Vercel Serverless Function - Troubleshooting lookup
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

let products = {};

function loadProducts() {
  if (Object.keys(products).length > 0) return products;
  const productsDir = join(process.cwd(), 'products');
  try {
    const skus = readdirSync(productsDir);
    for (const sku of skus) {
      const knowledgePath = join(productsDir, sku, 'knowledge.json');
      try {
        products[sku] = JSON.parse(readFileSync(knowledgePath, 'utf-8'));
      } catch (e) {}
    }
  } catch (e) {}
  return products;
}

function findProduct(query) {
  const prods = loadProducts();
  const q = query.toLowerCase().trim();
  if (prods[q]) return prods[q];
  for (const [sku, data] of Object.entries(prods)) {
    const model = data.product?.model?.toLowerCase() || '';
    if (model.includes(q) || q.includes(model)) return data;
  }
  return null;
}

function searchTroubleshooting(product, issue) {
  const troubleshooting = product.troubleshooting || [];
  const q = issue.toLowerCase();
  
  // Score each troubleshooting entry
  const scored = troubleshooting.map(t => {
    let score = 0;
    const issueText = t.issue?.toLowerCase() || '';
    const symptoms = t.symptoms?.toLowerCase() || '';
    
    // Check for keyword matches
    const keywords = q.split(/\s+/);
    for (const kw of keywords) {
      if (kw.length < 3) continue;
      if (issueText.includes(kw)) score += 10;
      if (symptoms.includes(kw)) score += 5;
      
      // Check causes/solutions
      for (const cs of (t.causes_solutions || [])) {
        if (cs.cause?.toLowerCase().includes(kw)) score += 3;
        if (cs.solution?.toLowerCase().includes(kw)) score += 2;
      }
    }
    return { ...t, score };
  });
  
  // Return top matches
  return scored.filter(t => t.score > 0).sort((a, b) => b.score - a.score);
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { sku, model, issue, problem } = req.method === 'POST' ? req.body : req.query;
  const productQuery = sku || model;
  const issueQuery = issue || problem;
  
  if (!productQuery) {
    return res.status(400).json({ error: 'Missing sku or model parameter' });
  }
  
  const product = findProduct(productQuery);
  if (!product) {
    return res.status(404).json({ error: 'Product not found', query: productQuery });
  }
  
  if (!issueQuery) {
    // Return all troubleshooting for product
    return res.json({
      product: product.product?.model,
      troubleshooting: product.troubleshooting || []
    });
  }
  
  const results = searchTroubleshooting(product, issueQuery);
  
  if (results.length === 0) {
    return res.json({
      product: product.product?.model,
      issue: issueQuery,
      message: "No specific troubleshooting found. Here are general tips:",
      troubleshooting: product.troubleshooting || [],
      support: product.support
    });
  }
  
  return res.json({
    product: product.product?.model,
    issue: issueQuery,
    troubleshooting: results,
    support: product.support
  });
}
