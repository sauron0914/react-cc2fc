# React Class Component To Function Component

## Usage

```bash
$ npx react-cc2fc start [directory | filePath]
```

## Example

demo.js
```js
import React, { Component } from 'react'
import Style from './deviceCell.less'

export default class DeviceCell extends Component {
  UNSAFE_componentWillMount () {
    Style.use()
  }

  render () {
    if (this.props.onClick) {
      return (
        <div className="device-cell">
          <button onClick={this.props.onClick && this.props.onClick.bind(this)}>
            <p>{this.props.title} <i className="dianfont icon-xuanze" /></p>
            <p>{this.props.value}</p>
          </button>
        </div>
      )
    }
    return (
      <div className="device-cell">
        <button>
          <p>{this.props.title}</p>
          <p>{this.props.value}</p>
        </button>
      </div>
    )
  }

  componentWillUnmount () {
    Style.unuse()
  }
}

```

```bash 
$ npx react-cc2fc start demo.js
```

```js
import React, { useEffect } from 'react'
import Style from './deviceCell.less'

const DeviceCell = (props) => {
  useEffect(() => {
    Style.use()

    return () => {
      Style.unuse()
    }
  }, [])

  if (props.onClick) {
    return (
      <div className="device-cell">
        <button onClick={props.onClick && props.onClick.bind(this)}>
          <p>{props.title} <i className="dianfont icon-xuanze" /></p>
          <p>{props.value}</p>
        </button>
      </div>
    )
  }
  return (
    <div className="device-cell">
      <button>
        <p>{props.title}</p>
        <p>{props.value}</p>
      </button>
    </div>
  )
}

export default DeviceCell

```


## Description
- If `React Class Component` contains the following life cycles, conversion is not supported temporarily

```ts
    componentWillReceiveProps

    UNSAFE_componentWillReceiveProps

    componentWillUpdate

    UNSAFE_componentWillUpdate

    getSnapshotBeforeUpdate

    componentDidUpdate

    getDerivedStateFromProps

    getDerivedStateFromError

    shouldComponentUpdate

    componentDidCatch

    getDefaultProps

    getInitialState
```

- The format of the file may be damaged. If necessary, please use eslint to process it uniformly
