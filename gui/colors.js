
export const rgba = (r, g, b, a = 1) => {
  return {
    $IS_CSS_VAL: true,
    r, g, b, a,
    toString () {
      return `rgba(${r}, ${g}, ${b}, ${a})`
    }
  }
}

export const Colors = {
  primary: rgba(169, 19, 4),
  font: rgba(10, 10, 10,),
  fontInv: rgba(250, 250, 250)
}

