import { createTheme } from '@mantine/core';

export const theme = createTheme({
  /** 复古自然风格主题 */
  colors: {
    // 主背景色 - 米白色系 (基于 #fcfcf2)
    'cream': [
      '#FEFEFA', // 0 - 最浅
      '#FCFCF2', // 1 - 基础色
      '#F8F8E8', // 2
      '#F4F4DE', // 3
      '#F0F0D4', // 4
      '#ECECCA', // 5
      '#E8E8C0', // 6
      '#E4E4B6', // 7
      '#E0E0AC', // 8
      '#DCDCA2', // 9 - 最深
    ],
    // 次要背景/强调色 - 淡黄绿色系 (基于 #e3e5ba)
    'sage-light': [
      '#FAFBF0', // 0
      '#F5F6E5', // 1
      '#EFF0DB', // 2
      '#E9EBD1', // 3
      '#E3E5BA', // 4 - 基础色
      '#D9DBA8', // 5
      '#CFD196', // 6
      '#C5C784', // 7
      '#BBBD72', // 8
      '#B1B360', // 9
    ],
    // 主要强调色 - 橄榄绿系 (基于 #cad086)
    'olive': [
      '#F5F7EC', // 0
      '#EAEDD9', // 1
      '#DFE3C6', // 2
      '#D4D9B3', // 3
      '#CAD086', // 4 - 基础色
      '#B8BE75', // 5
      '#A6AC64', // 6
      '#949A53', // 7
      '#828842', // 8
      '#707631', // 9
    ],
    // 深色强调 - 深橄榄绿 (基于 #a4a770)
    'olive-dark': [
      '#F0F1E5', // 0
      '#E1E2CB', // 1
      '#D2D3B1', // 2
      '#C3C497', // 3
      '#B4B57D', // 4
      '#A4A770', // 5 - 基础色
      '#929562', // 6
      '#808354', // 7
      '#6E7146', // 8
      '#5C5F38', // 9
    ],
    // 暖色强调 - 铜棕色 (基于 #b98d57)
    'copper': [
      '#FBF5EF', // 0
      '#F6EBE0', // 1
      '#F1E1D1', // 2
      '#ECD7C2', // 3
      '#E7CDB3', // 4
      '#B98D57', // 5 - 基础色
      '#A87E4A', // 6
      '#976F3D', // 7
      '#866030', // 8
      '#755123', // 9
    ],
    // 中性灰褐 - 大地色系 (基于 #88865b)
    'earth': [
      '#F5F4F0', // 0
      '#EAE9E1', // 1
      '#DFDED2', // 2
      '#D4D3C3', // 3
      '#C9C8B4', // 4
      '#88865B', // 5 - 基础色
      '#7A7852', // 6
      '#6C6A49', // 7
      '#5E5C40', // 8
      '#504E37', // 9
    ],
    // 深色文字/边框 (基于 #706445)
    'brown-dark': [
      '#F2F0EC', // 0
      '#E4E1D9', // 1
      '#D6D2C6', // 2
      '#C8C3B3', // 3
      '#BAB5A0', // 4
      '#706445', // 5 - 基础色
      '#645A3E', // 6
      '#585037', // 7
      '#4C4630', // 8
      '#403C29', // 9
    ],
    // 最深色 - 深褐色 (基于 #39321d)
    'deep-brown': [
      '#EDECE8', // 0
      '#DBD9D1', // 1
      '#C9C6BA', // 2
      '#B7B3A3', // 3
      '#A5A08C', // 4
      '#736845', // 5
      '#564F34', // 6
      '#39321D', // 7 - 基础色
      '#2E2817', // 8
      '#231E11', // 9 - 最深
    ],
  },
  fontFamily: 'Rondal, "Source Han Serif SC", serif',
  headings: { 
    fontFamily: 'Playfair Display, "Source Han Serif SC", serif',
    fontWeight: '500',
  },
  radius: { 
    xs: '0',
    sm: '0', 
    md: '2px', 
    lg: '2px',
    xl: '2px',
  },
  defaultRadius: '2px',
  components: {
    Card: {
      defaultProps: {
        shadow: 'none',
        radius: '0',
      },
    },
    Button: {
      defaultProps: {
        radius: '0',
      },
    },
    ActionIcon: {
      defaultProps: {
        radius: '0',
      },
    },
  },
});
