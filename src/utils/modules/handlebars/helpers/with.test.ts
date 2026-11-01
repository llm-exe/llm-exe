import { withFn } from './with';

describe('withFn', () => {
    it('should call options.fn with the provided context', () => {
        const context = { key: 'value' };
        const options = {
            fn: jest.fn()
        };

        withFn.call({}, context, options);

        expect(options.fn).toHaveBeenCalledWith(context);
    });

    it('should return the result of options.fn', () => {
        const context = { key: 'value' };
        const expectedResult = 'result';
        const options = {
            fn: jest.fn().mockReturnValue(expectedResult)
        };

        const result = withFn.call({}, context, options);

        expect(result).toBe(expectedResult);
    });
});
