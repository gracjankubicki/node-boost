export default async function ProductsPage() {
  const res = await fetch("https://example.com/products");
  return <main>{res.status}</main>;
}
