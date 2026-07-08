import { internalCartState } from "../cart/internal";
import Page from "../../app/page";

export function useCheckout() {
  return { internalCartState, Page };
}
