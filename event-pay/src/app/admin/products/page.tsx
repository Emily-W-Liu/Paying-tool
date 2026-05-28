import { redirect } from "next/navigation";

export default function AdminProductsRedirectPage() {
  redirect("/merchant/products");
}
