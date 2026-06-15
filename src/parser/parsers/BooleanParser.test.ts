import { BaseParser, BooleanParser } from "@/parser";

/**
 * Tests the BooleanParser class
 */
describe("llm-exe:parser/BooleanParser", () => {
  it('creates class with expected properties', () => {
    const parser = new BooleanParser()
    expect(parser).toBeInstanceOf(BaseParser)
    expect(parser).toBeInstanceOf(BooleanParser)
    expect(parser).toHaveProperty("name")
    expect(parser.name).toEqual("boolean")
  })
  it('parses "true" as true', () => {
    const parser = new BooleanParser()
    expect(parser.parse("true")).toEqual(true)
  })
  it('parses "True" as true (case-insensitive)', () => {
    const parser = new BooleanParser()
    expect(parser.parse("True")).toEqual(true)
  })
  it('parses "yes" as true', () => {
    const parser = new BooleanParser()
    expect(parser.parse("yes")).toEqual(true)
  })
  it('parses "Yes" as true (case-insensitive)', () => {
    const parser = new BooleanParser()
    expect(parser.parse("Yes")).toEqual(true)
  })
  it('parses "y" as true', () => {
    const parser = new BooleanParser()
    expect(parser.parse("y")).toEqual(true)
  })
  it('parses "1" as true', () => {
    const parser = new BooleanParser()
    expect(parser.parse("1")).toEqual(true)
  })
  it('parses "false" as false', () => {
    const parser = new BooleanParser()
    expect(parser.parse("false")).toEqual(false)
  })
  it('parses "no" as false', () => {
    const parser = new BooleanParser()
    expect(parser.parse("no")).toEqual(false)
  })
  it('parses "0" as false', () => {
    const parser = new BooleanParser()
    expect(parser.parse("0")).toEqual(false)
  })
  it('parses "n" as false', () => {
    const parser = new BooleanParser()
    expect(parser.parse("n")).toEqual(false)
  })
  it('handles whitespace around value', () => {
    const parser = new BooleanParser()
    expect(parser.parse("  yes  ")).toEqual(true)
  })

  describe("edge cases on input shape", () => {
    it("throws on non-string input (number)", () => {
      const parser = new BooleanParser();
      const badValue = 1 as unknown as string;
      expect(() => parser.parse(badValue)).toThrow(
        "Invalid input. Expected string. Received number."
      );
    });

    it("throws on null input", () => {
      const parser = new BooleanParser();
      const badValue = null as unknown as string;
      expect(() => parser.parse(badValue)).toThrow(
        "Invalid input. Expected string. Received object."
      );
    });

    it("throws on undefined input", () => {
      const parser = new BooleanParser();
      const badValue = undefined as unknown as string;
      expect(() => parser.parse(badValue)).toThrow(
        "Invalid input. Expected string. Received undefined."
      );
    });

    it("throws on object input", () => {
      const parser = new BooleanParser();
      const badValue = { yes: true } as unknown as string;
      expect(() => parser.parse(badValue)).toThrow(
        "Invalid input. Expected string. Received object."
      );
    });

    it("returns false for empty string", () => {
      const parser = new BooleanParser();
      expect(parser.parse("")).toEqual(false);
    });

    it("returns false for whitespace-only string", () => {
      const parser = new BooleanParser();
      expect(parser.parse("   \n\t  ")).toEqual(false);
    });
  });

  describe("case-insensitive truthy values", () => {
    it('parses "TRUE" (all caps) as true', () => {
      const parser = new BooleanParser();
      expect(parser.parse("TRUE")).toEqual(true);
    });

    it('parses "YES" (all caps) as true', () => {
      const parser = new BooleanParser();
      expect(parser.parse("YES")).toEqual(true);
    });

    it('parses "Y" (uppercase) as true', () => {
      const parser = new BooleanParser();
      expect(parser.parse("Y")).toEqual(true);
    });

    it('parses mixed-case "TrUe" as true', () => {
      const parser = new BooleanParser();
      expect(parser.parse("TrUe")).toEqual(true);
    });

    it('handles surrounding tabs and newlines for truthy values', () => {
      const parser = new BooleanParser();
      expect(parser.parse("\n\tyes\t\n")).toEqual(true);
      expect(parser.parse("\n true \n")).toEqual(true);
    });
  });

  describe("falsy values (anything not in truthy set)", () => {
    it("returns false for arbitrary text", () => {
      const parser = new BooleanParser();
      expect(parser.parse("maybe")).toEqual(false);
      expect(parser.parse("definitely not")).toEqual(false);
      expect(parser.parse("nope")).toEqual(false);
    });

    it("returns false for any number other than 1 (single token)", () => {
      const parser = new BooleanParser();
      expect(parser.parse("2")).toEqual(false);
      expect(parser.parse("-1")).toEqual(false);
      expect(parser.parse("100")).toEqual(false);
    });

    it("returns false when truthy keyword is embedded in a longer string", () => {
      // "yes" alone is true, but "yes please" should be false because
      // the parser does an exact-equality check after trim/lowercase,
      // not a substring match. This documents the existing behavior.
      const parser = new BooleanParser();
      expect(parser.parse("yes please")).toEqual(false);
      expect(parser.parse("true story")).toEqual(false);
    });
  });
});

