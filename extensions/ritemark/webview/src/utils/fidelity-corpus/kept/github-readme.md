# tinyqueue-lite

A small priority queue for Node.js and the browser.

## Install

```bash
npm install tinyqueue-lite
```

## Usage

```js
import { Queue } from 'tinyqueue-lite'

const queue = new Queue([5, 1, 3])
queue.push(2)
queue.pop() // 1
```

## API

### `new Queue(items?, compare?)`

Creates a queue. `compare` defaults to `(a, b) => a - b`.

### `queue.push(item)`

Adds an item.

### `queue.pop()`

Removes and returns the smallest item, or `undefined` when the queue is empty.

## Benchmarks

| Operation | ops/sec |
| --- | --- |
| push | 12,000,000 |
| pop | 9,500,000 |

## License

MIT. See [LICENSE](LICENSE) and [the changelog](docs/CHANGELOG.md).
