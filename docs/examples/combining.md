---
title: "Combine Multiple LLM Executors in TypeScript | llm-exe"
description: "Chain two LLM executors into one TypeScript function: the first plans a list of test cases, the second writes each Jest test, producing a full test suite."
---

## Simple Combining  

In this example, we will create a single function that wraps 2 executor functions. The function will be provided a block of code, and will output some Jest tests. Instead of just saying 'write me jest tests', we will have the LLM plan a bit in advance. 

This can be useful as:
- Planning any ideas
- Iterating on plans

This is really just a simple loop that combines 2 functions, but using LLM executors keeps the code simple.

#### Step 1 - Create LLM Executor to make list of test cases given a function

<<< ../../examples/ListInList.ts#StepOne

#### Step 2 - Create LLM Executor to write single test case
<<< ../../examples/ListInList.ts#StepTwo

#### Step 3 - Combine into single method
Combine the prompt, LLM, and parser into a single function.

<<< ../../examples/ListInList.ts#StepThree


#### Step 4 - Use it!
```ts
import { generateTestSuite } from "./somewhere"

// the input you get from somewhere
const functionToTest = `function add(a: number, b: number){
    return a + b;
}`;

const response = await generateTestSuite({
    functionToTest
});

/**
 * 
 * console.log(response)
 * {
    "requirements": [
        "Test case 1: Test adding two positive numbers",
        "Test case 2: Test adding two negative numbers",
        "Test case 3: Test adding a positive number and a negative number",
        "Test case 4: Test adding zero to a positive number",
        "Test case 5: Test adding zero to a negative number",
        "Test case 6: Test adding zero to zero",
        "Test case 7: Test adding a positive number to the maximum safe integer value",
        "Test case 8: Test adding a negative number to the minimum safe integer value",
        "Test case 9: Test adding a positive number to Infinity",
        "Test case 10: Test adding a negative number to -Infinity",
        "Test case 11: Test adding a positive number to NaN",
        "Test case 12: Test adding a negative number to NaN",
        "Test case 13: Test adding a positive number to a string",
        "Test case 14: Test adding a negative number to a string",
        "Test case 15: Test adding a positive number to an empty string",
        "Test case 16: Test adding a negative number to an empty string",
        "Test case 17: Test adding a positive number to null",
        "Test case 18: Test adding a negative number to null",
        "Test case 19: Test adding a positive number to undefined",
        "Test case 20: Test adding a negative number to undefined"
    ],
    "tests": [
        "it('should add two positive numbers', () => {\n  // Arrange\n  const a = 2;\n  const b = 3;\n\n  // Act\n  const result = add(a, b);\n\n  // Assert\n  expect(result).toBe(5);\n});",
        "it('Test adding two negative numbers', () => {\n  expect(add(-5, -10)).toBe(-15);\n});",
        "it('should add a positive number and a negative number', () => {\n  const result = add(5, -3);\n  expect(result).toBe(2);\n});",
        "it('should add zero to a positive number', () => {\n  // Arrange\n  const a = 5;\n  const b = 0;\n\n  // Act\n  const result = add(a, b);\n\n  // Assert\n  expect(result).toBe(5);\n});",
        "it('should add zero to a negative number', () => {\n  const result = add(-5, 0);\n  expect(result).toBe(-5);\n});",
        "it('Test adding zero to zero', () => {\n  expect(add(0, 0)).toBe(0);\n});",
        "it('Test adding a positive number to the maximum safe integer value', () => {\n  const result = add(Number.MAX_SAFE_INTEGER, 5);\n  expect(result).toBe(Number.MAX_SAFE_INTEGER + 5);\n});",
        "it('Test adding a negative number to the minimum safe integer value', () => {\n  const result = add(Number.MIN_SAFE_INTEGER, -5);\n  expect(result).toBe(Number.MIN_SAFE_INTEGER - 5);\n});",
        "it('should add a positive number to Infinity', () => {\n  expect(add(5, Infinity)).toBe(Infinity);\n});",
        "it('Test adding a negative number to -Infinity', () => {\n  expect(add(-5, -Infinity)).toBe(-Infinity);\n});",
        "it('Test adding a positive number to NaN', () => {\n  const result = add(5, NaN);\n  expect(result).toBeNaN();\n});",
        "it('Test adding a negative number to NaN', () => {\n  const result = add(-5, NaN);\n  expect(result).toBeNaN();\n});",
        "it('should add a positive number to a string', () => {\n  const result = add(5, '10');\n  expect(result).toBe('510');\n});",
        "it('should add a negative number to a string', () => {\n  const result = add(-5, '10');\n  expect(result).toBe('5-10');\n});",
        "it('should add a positive number to an empty string', () => {\n  const result = add(5, '');\n  expect(result).toBe('5');\n});",
        "it('should add a negative number to an empty string', () => {\n  const result = add(-5, 0);\n  expect(result).toBe(-5);\n});",
        "it('should add a positive number to null', () => {\n  const result = add(5, null);\n  expect(result).toBe(5);\n});",
        "it('should add a negative number to null', () => {\n  const result = add(-5, null);\n  expect(result).toBe(-5);\n});",
        "it('Test adding a positive number to undefined', () => {\n  expect(add(5, undefined)).toBeNaN();\n});",
        "it('Test adding a negative number to undefined', () => {\n  expect(add(-5, undefined)).toBeNaN();\n});"
    ]
}
 ** 
 */
```

### Complete File
<<< ../../examples/ListInList.ts