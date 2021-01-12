const DescriptionContainer = (props)=> {

  const [val, setVal] = useState(undefined)
 
  useEffect(()=> {
    Style.use()
    return ()=> {
      Style.unuse()
    }
  },[])

  const sayHello = () => {
    console.log('hello')
  }

  return (()=>{
    const { demo } = val
    const demo1 = 'fa'
    const demo2 = 'fa'
    const demo3 = 'fa'
    return <div className="description">
      { demo && <p>设备考核周期：设备安装成功后30天；</p> }
      <p>达标的定义：30天内订单数大于等于10笔；</p>
    </div>
  })()

}


export default DescriptionContainer
