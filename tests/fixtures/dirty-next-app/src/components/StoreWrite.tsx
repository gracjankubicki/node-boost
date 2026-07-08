const useCartStore = { setState: (_value: unknown) => undefined };

export async function loadCart() {
  const data = await fetch("/api/cart");
  useCartStore.setState(data);
}
