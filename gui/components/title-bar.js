import React, { Component } from 'react'

const TitleBar = CSS({
  '.title': {
    background: Colors.primary,
    WebkitAppRegion: 'drag',
    color: Colors.fontInv
  }
})((props) => {
  const { children } = props
  return (
    <div className="title">
      {children}
    </div>
  )
})
console.log(TitleBar)

export default TitleBar

