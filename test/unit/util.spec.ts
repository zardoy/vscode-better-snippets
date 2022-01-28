import {
  normalizeLanguages,
  langsEquals,
  langsSupersets,
} from "../../src/util";

test("normalizeLanguages", () => {
  expect(normalizeLanguages("javascriptreact")).toMatchInlineSnapshot(`
    Array [
      "javascriptreact",
    ]
  `);
  expect(normalizeLanguages("js")).toMatchInlineSnapshot(`
    Array [
      "typescript",
      "javascript",
      "typescriptreact",
      "javascriptreact",
    ]
  `);
  expect(normalizeLanguages(["typescriptreact", "typescript", "ts", "styles"]))
    .toMatchInlineSnapshot(`
    Array [
      "typescriptreact",
      "typescript",
      "typescript",
      "typescriptreact",
      "css",
      "scss",
      "sass",
      "source.css.styled",
    ]
  `);
  expect(normalizeLanguages([])).toMatchInlineSnapshot(`Array []`);
});

test("langEquals", () => {
  expect(
    langsEquals(langsSupersets.js, normalizeLanguages("js"))
  ).toMatchInlineSnapshot(`true`);
});
