import React from 'react'

class DescriptionContainer extends Component {
  constructor (props) {
    super(props)
    this.state = {
      isShow: [],
      da: '231'
    }
  }

  componentWillUnmount () {
    Style.unuse.demo(this.state.isShow)
    this.setState({isShow: true})
  }

  componentDidMount () {
    Style()
    console.log(this.state.isShow)
    console.log(this.state.da)
    this.setState({
      isShow: '3131' + '31231',
      da: '131'
    })
    this.setState({
      da: 'dada'
    })
  }

  sayHello(val, str) {
    console.log('hello', val, str)
  }

  render () {
    return (
      <div className="description">
        { this.props.demo && this.state.isShow && <p>设备考核周期：设备安装成功后30天；</p> }
        <p>达标的定义：30天内订单数大于等于10笔；</p>
      </div>
    )
  }
}

export default DescriptionContainer
