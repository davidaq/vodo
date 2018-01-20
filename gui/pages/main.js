import React, { Component } from 'react'
import TitleBar from '../components/title-bar'

@CSS({
  ':global': {
    'html, body': {
      padding: 0,
      margin: 0,
      width: '100%',
      height: '100%'
    }
  }
})
class Main extends React.Component {
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

