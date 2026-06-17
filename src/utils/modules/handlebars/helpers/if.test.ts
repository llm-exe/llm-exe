import { ifFn } from "./if";
import { isEmpty } from "@/utils/modules/isEmpty";
import { LlmExeError } from "@/errors";

jest.mock("@/utils/modules/isEmpty");

describe("ifFn", () => {
    const fn = jest.fn();
    const inverse = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should throw an error if arguments length is not 2", () => {
        expect(() => (ifFn as any).call({}, true)).toThrow("#if requires exactly one argument");
    });

    it("throws LlmExeError with template.invalid_helper_arguments on wrong arg count", () => {
        try {
            (ifFn as any).call({}, true);
            fail("Expected an error to be thrown");
        } catch (e) {
            expect(e).toBeInstanceOf(LlmExeError);
            expect((e as LlmExeError).code).toBe("template.invalid_helper_arguments");
            expect((e as LlmExeError).category).toBe("template");
            const ctx = (e as LlmExeError).context as Record<string, unknown>;
            expect(ctx.operation).toBe("handlebars.helper.if");
            expect(ctx.helper).toBe("if");
            expect(ctx.expected).toBe(1);
            expect(ctx.received).toBe(1);
        }
    });

    it("should call the conditional function if conditional is a function", () => {
        const conditional = jest.fn().mockReturnValue(true);
        ifFn.call({}, conditional, { fn, inverse, hash: {} });
        expect(conditional).toHaveBeenCalled();
    });

    it("should call options.fn if conditional is truthy and not empty", () => {
        (isEmpty as unknown as jest.Mock).mockReturnValue(false);
        ifFn.call({}, true, { fn, inverse, hash: {} });
        expect(fn).toHaveBeenCalled();
        expect(inverse).not.toHaveBeenCalled();
    });

    it("should call options.inverse if conditional is falsy and not includeZero", () => {
        (isEmpty  as unknown as  jest.Mock).mockReturnValue(true);
        ifFn.call({}, false, { fn, inverse, hash: {} });
        expect(inverse).toHaveBeenCalled();
        expect(fn).not.toHaveBeenCalled();
    });

    it("should call options.fn if conditional is 0 and includeZero is true", () => {
        (isEmpty  as unknown as  jest.Mock).mockReturnValue(false);
        ifFn.call({}, 0, { fn, inverse, hash: { includeZero: true } });
        expect(fn).toHaveBeenCalled();
        expect(inverse).not.toHaveBeenCalled();
    });

    it("should call options.inverse if conditional is 0 and includeZero is false", () => {
        (isEmpty  as unknown as  jest.Mock).mockReturnValue(true);
        ifFn.call({}, 0, { fn, inverse, hash: { includeZero: false } });
        expect(inverse).toHaveBeenCalled();
        expect(fn).not.toHaveBeenCalled();
    });
});