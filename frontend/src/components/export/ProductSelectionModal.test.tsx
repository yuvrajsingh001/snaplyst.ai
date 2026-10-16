import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadCsv, exportDepopCsv, exportShopifyCsv } from "@/lib/export";
import ProductSelectionModal from "./ProductSelectionModal";

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://cdn.example/${path}` },
        }),
      }),
    },
  },
}));

vi.mock("@/lib/export", () => ({
  exportDepopCsv: vi.fn(async () => "depop-csv"),
  exportShopifyCsv: vi.fn(async () => "shopify-csv"),
  downloadCsv: vi.fn(),
}));

const products = [
  {
    product: {
      id: "p1",
      title: "Vintage Jacket",
      description: "Wool",
      price: 45,
      metadata: {
        channels: { depopEnabled: true, shopifyEnabled: false },
      },
    },
    images: [
      { id: "img-1", storage_path: "user/jacket.jpg", filename: "jacket.jpg" },
      { id: "img-2", storage_path: "user/jacket-2.jpg", filename: "jacket-2.jpg" },
    ],
  },
  {
    product: {
      id: "p2",
      title: "Shopify Tee",
      description: "Cotton",
      price: 20,
      metadata: {
        channels: { depopEnabled: false, shopifyEnabled: true },
      },
    },
    images: [{ id: "img-3", storage_path: "user/tee.jpg" }],
  },
];

describe("ProductSelectionModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing while closed", () => {
    const { container } = render(
      <ProductSelectionModal
        isOpen={false}
        onClose={vi.fn()}
        platform="depop"
        products={products}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("lists only products enabled for the selected channel and selects them", async () => {
    render(
      <ProductSelectionModal
        isOpen
        onClose={vi.fn()}
        platform="depop"
        products={products}
      />,
    );

    expect(await screen.findByText("Vintage Jacket")).toBeInTheDocument();
    expect(screen.queryByText("Shopify Tee")).not.toBeInTheDocument();
    expect(screen.getByText("2 images • $45")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Vintage Jacket" })).toHaveAttribute(
      "src",
      "https://cdn.example/user/jacket.jpg",
    );
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByRole("button", { name: "Export 1 Product" })).toBeEnabled();
  });

  it("shows the Shopify product when that platform is selected", async () => {
    render(
      <ProductSelectionModal
        isOpen
        onClose={vi.fn()}
        platform="shopify"
        products={products}
      />,
    );

    expect(await screen.findByText("Shopify Tee")).toBeInTheDocument();
    expect(screen.queryByText("Vintage Jacket")).not.toBeInTheDocument();
    expect(screen.getByText("1 image • $20")).toBeInTheDocument();
  });

  it("explains when nothing is configured for the channel", async () => {
    render(
      <ProductSelectionModal
        isOpen
        onClose={vi.fn()}
        platform="depop"
        products={[products[1]]}
      />,
    );

    expect(
      await screen.findByText("No products configured for Depop"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No Products Available" })).toBeDisabled();
  });

  it("deselects products and disables export until one is chosen again", async () => {
    const user = userEvent.setup();
    render(
      <ProductSelectionModal
        isOpen
        onClose={vi.fn()}
        platform="depop"
        products={products}
      />,
    );

    await screen.findByText("Vintage Jacket");
    await user.click(screen.getByRole("button", { name: "Deselect All" }));
    expect(screen.getByRole("button", { name: "Export 0 Products" })).toBeDisabled();

    await user.click(screen.getByText("Vintage Jacket"));
    expect(screen.getByRole("button", { name: "Export 1 Product" })).toBeEnabled();
  });

  it("downloads the Depop CSV for the selected products and closes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ProductSelectionModal
        isOpen
        onClose={onClose}
        platform="depop"
        products={products}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Export 1 Product" }));

    expect(exportDepopCsv).toHaveBeenCalledTimes(1);
    const exported = vi.mocked(exportDepopCsv).mock.calls[0][0];
    expect(exported).toHaveLength(1);
    expect(exported[0].id).toBe("p1");
    expect(exported[0].images[0].publicUrl).toBe("https://cdn.example/user/jacket.jpg");
    expect(downloadCsv).toHaveBeenCalledWith(
      "depop-csv",
      expect.stringMatching(/^depop-export-\d{4}-\d{2}-\d{2}\.csv$/),
    );
    expect(exportShopifyCsv).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the modal open and alerts when export fails", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    vi.mocked(exportShopifyCsv).mockRejectedValueOnce(new Error("template missing"));
    vi.spyOn(window, "alert").mockImplementation(() => {});

    render(
      <ProductSelectionModal
        isOpen
        onClose={onClose}
        platform="shopify"
        products={products}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Export 1 Product" }));

    expect(window.alert).toHaveBeenCalledWith(
      expect.stringContaining("template missing"),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Export 1 Product" })).toBeEnabled();
  });
});
