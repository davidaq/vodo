import TitleBar from '../components/title-bar'

@requireWindow
class Main extends React.Component {
  componentWillMount () {
    this.context.nativeWindow.setMinimumSize(500, 350)
  }
  render () {
    return (
      <div>
        <TitleBar>
          Title!!
        </TitleBar>
        hello world
      </div>
    )
  }
}

export default Main

