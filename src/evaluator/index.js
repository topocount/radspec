const ABI = require('web3-eth-abi')
const types = require('../types')

class TypedValue {
  constructor (type, value) {
    this.type = type
    this.value = value
  }

  toString () {
    return this.value.toString()
  }
}

class Evaluator {
  constructor (ast, bindings) {
    this.ast = ast
    this.bindings = bindings
  }

  async evaluateNodes (nodes) {
    return Promise.all(
      nodes.map(this.evaluateNode.bind(this))
    )
  }

  async evaluateNode (node) {
    if (node.type === 'ExpressionStatement') {
      return (await this.evaluateNodes(node.body)).join(' ')
    }

    if (node.type === 'MonologueStatement') {
      return new TypedValue('string', node.value)
    }

    if (node.type === 'StringLiteral') {
      return new TypedValue('string', node.value)
    }

    if (node.type === 'NumberLiteral') {
      return new TypedValue('int256', node.value)
    }

    if (node.type === 'BinaryExpression') {
      const left = await this.evaluateNode(node.left)
      const right = await this.evaluateNode(node.right)

      // TODO Additionally check that the type is signed if subtracting
      if (!types.isInteger(left.type) ||
        !types.isInteger(right.type)) {
        this.panic(`Cannot evaluate binary expression "${node.operator}" for non-integer types "${left.type}" and "${right.type}"`)
      }

      switch (node.operator) {
        case 'PLUS':
          return new TypedValue('int256', left.value + right.value)
        case 'MINUS':
          return new TypedValue('int256', left.value - right.value)
        case 'STAR':
          return new TypedValue('int256', left.value * right.value)
        case 'SLASH':
          return new TypedValue('int256', left.value / right.value)
        default:
          this.panic(`Undefined binary operator "${node.operator}"`)
      }
    }

    if (node.type === 'Identifier') {
      if (!this.bindings.hasOwnProperty(node.value)) {
        this.panic(`Undefined binding "${node.value}"`)
      }

      const binding = this.bindings[node.value]
      return new TypedValue(binding.type, binding.value)
    }

    if (node.type === 'CallExpression') {
      // TODO Add a check for number of return values (can only be 1 for now)
      const address = await this.evaluateNode(node.target)
      const inputs = await this.evaluateNodes(node.inputs)
      const outputs = node.outputs
      const call = ABI.encodeFunctionCall({
        name: node.callee,
        type: 'function',

        inputs: inputs.map((input) => input.type),
        outputs: outputs.map((output) => output.type)
      }, inputs.map((input) => input.value))

      return `(${call} -> ${address})`
    }
  }

  async evaluate () {
    return this.evaluateNodes(
      this.ast.body
    ).then(
      (evaluatedNodes) => evaluatedNodes.join('')
    )
  }

  panic (msg) {
    throw new Error(`Error: ${msg}`)
  }
}

module.exports = {
  Evaluator,

  evaluate (ast, bindings) {
    return new Evaluator(ast, bindings).evaluate()
  }
}