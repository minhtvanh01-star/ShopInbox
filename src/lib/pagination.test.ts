import { describe, expect, it } from "vitest";
import {
  PAGE_SIZE,
  buildPageHref,
  paginationMeta,
  paginationSkip,
  parsePage,
} from "./pagination";

describe("parsePage", () => {
  it("mặc định 1", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("0")).toBe(1);
  });

  it("lấy số nguyên dương", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["2"])).toBe(2);
  });
});

describe("paginationMeta", () => {
  it("tính pageCount", () => {
    expect(paginationMeta(0, 1)).toEqual({
      page: 1,
      pageSize: PAGE_SIZE,
      total: 0,
      pageCount: 1,
    });
    expect(paginationMeta(26, 1).pageCount).toBe(2);
    expect(paginationMeta(26, 9).page).toBe(2);
  });
});

describe("paginationSkip", () => {
  it("skip theo trang", () => {
    expect(paginationSkip(1)).toBe(0);
    expect(paginationSkip(2)).toBe(PAGE_SIZE);
  });
});

describe("buildPageHref", () => {
  it("bỏ page=1", () => {
    expect(buildPageHref("/orders", { status: "new" }, 1)).toBe("/orders?status=new");
    expect(buildPageHref("/orders", { status: "new" }, 2)).toBe("/orders?status=new&page=2");
  });
});
