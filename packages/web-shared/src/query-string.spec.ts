import { queryString } from "./query-string";

describe("queryString", () => {
  it("omits undefined and empty values", () => {
    expect(queryString({ page: 2, search: "maju", empty: "", next: undefined })).toBe(
      "?page=2&search=maju",
    );
  });

  it("returns an empty string when there is nothing to serialize", () => {
    expect(queryString({})).toBe("");
    expect(queryString({ search: undefined })).toBe("");
  });
});
