
import { BaseParser, ListToArrayParser } from "@/parser";
import { LlmExeError } from "@/errors";

/**
 * Tests the ListToArrayParser class
 */
describe("llm-exe:parser/ListToArrayParser", () => {
  it('creates class with expected properties', () => {
    const parser = new ListToArrayParser()
    expect(parser).toBeInstanceOf(BaseParser)
    expect(parser).toBeInstanceOf(ListToArrayParser)
    expect(parser).toHaveProperty("name")
    expect(parser.name).toEqual("listToArray")
  });
  it('removes hyphens', () => {
    const parser = new ListToArrayParser()
    const input = `- Greg\n- Developer`
    expect(parser.parse(input)).toEqual(["Greg", "Developer"])
  });
  it('parses simple string correctly', () => {
    const parser = new ListToArrayParser()
    const input = `Name: Greg\nOccupation: developer`
    expect(parser.parse(input)).toEqual(["Name: Greg", "Occupation: developer"])
  });
  it('trims extra spaces', () => {
    const parser = new ListToArrayParser()
    const input = `- Greg  \n- Developer  `
    expect(parser.parse(input)).toEqual(["Greg", "Developer"])
  });
  it('doesn\'t remove hyphens in the that aren\'t first', () => {
    const parser = new ListToArrayParser()
    const input = `- Greg\n- Occupation: software - developer`
    expect(parser.parse(input)).toEqual(["Greg", "Occupation: software - developer"])
  });
  it('removes numbered list prefixes', () => {
    const parser = new ListToArrayParser()
    const input = `1. First\n2. Second\n3. Third`
    expect(parser.parse(input)).toEqual(["First", "Second", "Third"])
  });
  it('removes asterisk list prefixes', () => {
    const parser = new ListToArrayParser()
    const input = `* First\n* Second\n* Third`
    expect(parser.parse(input)).toEqual(["First", "Second", "Third"])
  });
  it('handles mixed list formats', () => {
    const parser = new ListToArrayParser()
    const input = `- First\n* Second\n3. Third`
    expect(parser.parse(input)).toEqual(["First", "Second", "Third"])
  });
  it('preserves asterisks that are not list prefixes', () => {
    const parser = new ListToArrayParser()
    const input = `* bold text * here\n* another item`
    expect(parser.parse(input)).toEqual(["bold text * here", "another item"])
  });
  it('handles CRLF and blank lines', () => {
    const parser = new ListToArrayParser()
    const input = `One\r\n\r\nTwo`
    expect(parser.parse(input)).toEqual(["One", "Two"])
  });
  it('preserves apostrophes exactly', () => {
    const parser = new ListToArrayParser()
    expect(parser.parse("- can't")).toEqual(["can't"])
  });
  it('throws parser.parse_failed for empty input', () => {
    const parser = new ListToArrayParser()
    try {
      parser.parse("")
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).context).toEqual({
        operation: "ListToArrayParser.parse",
        parser: "listToArray",
        reason: "empty_input",
        inputLength: 0,
      })
    }
  });
  it('throws parser.parse_failed for a single unmarked prose line', () => {
    const parser = new ListToArrayParser()
    try {
      parser.parse("This is a paragraph.")
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).context).toMatchObject({
        operation: "ListToArrayParser.parse",
        parser: "listToArray",
        reason: "not_list_like",
      })
    }
  });
  it('accepts a single marked item', () => {
    const parser = new ListToArrayParser()
    expect(parser.parse("- One")).toEqual(["One"])
  });
  it('throws parser.parse_failed for mixed marked and unmarked lines', () => {
    const parser = new ListToArrayParser()
    try {
      parser.parse("- One\nTwo")
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).context).toMatchObject({
        operation: "ListToArrayParser.parse",
        parser: "listToArray",
        reason: "mixed_list_markers",
      })
    }
  });
  it('throws parser.parse_failed for invalid input type', () => {
    const parser = new ListToArrayParser()
    expect(() => {
      // @ts-expect-error runtime contract: parser rejects null input.
      parser.parse(null)
    }).toThrow(LlmExeError)
  });
  it('describes array invalid input type in parser context', () => {
    const parser = new ListToArrayParser()
    try {
      // @ts-expect-error runtime contract: parser rejects array input.
      parser.parse([])
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).context).toMatchObject({
        reason: "invalid_input_type",
        received: "array",
      })
    }
  });
  it('describes object invalid input type in parser context', () => {
    const parser = new ListToArrayParser()
    try {
      // @ts-expect-error runtime contract: parser rejects object input.
      parser.parse({})
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).context).toMatchObject({
        reason: "invalid_input_type",
        received: "object",
      })
    }
  });
});
