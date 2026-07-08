"use client";

export function ProductList() {
  fetch("/api/products");
  return <main>Products</main>;
}
