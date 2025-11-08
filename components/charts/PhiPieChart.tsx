'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { motion } from 'framer-motion'

interface PhiPieChartProps {
  data: Array<{
    name: string
    value: number
    color?: string
  }>
  title?: string
  showLegend?: boolean
  innerRadius?: number
  size?: 'sm' | 'md' | 'lg'
  animated?: boolean
}

const PHI_COLORS = [
  '#A96B48', // phi-gold
  '#8FBCBB', // phi-mint
  '#D08770', // phi-coral
  '#4C566A', // phi-slate
  '#88C0D0', // light blue
  '#B48EAD', // purple
  '#EBCB8B', // yellow
  '#A3BE8C', // green
]

export default function PhiPieChart({
  data,
  title,
  showLegend = true,
  innerRadius = 60,
  size = 'md',
  animated = true
}: PhiPieChartProps) {
  const sizes = {
    sm: { height: 200, outerRadius: 70 },
    md: { height: 300, outerRadius: 100 },
    lg: { height: 400, outerRadius: 130 }
  }

  const { height, outerRadius } = sizes[size]

  // Add colors to data if not provided
  const coloredData = data.map((item, index) => ({
    ...item,
    color: item.color || PHI_COLORS[index % PHI_COLORS.length]
  }))

  const total = data.reduce((sum, item) => sum + item.value, 0)

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const percentage = ((payload[0].value / total) * 100).toFixed(1)
      return (
        <div className="bg-white px-4 py-2 rounded-lg shadow-lg border border-phi-frost">
          <p className="font-bold text-phi-dark">{payload[0].name}</p>
          <p className="text-phi-slate">
            ₪{payload[0].value.toLocaleString()} ({percentage}%)
          </p>
        </div>
      )
    }
    return null
  }

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null // Don't show labels for very small slices
    
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180)
    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180)

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-sm font-bold"
        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  return (
    <motion.div
      initial={animated ? { opacity: 0, scale: 0.9 } : {}}
      animate={animated ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-2xl p-6 shadow-lg border border-phi-frost"
    >
      {title && (
        <h3 className="text-xl font-bold text-phi-dark mb-4 flex items-center gap-2">
          <span className="text-2xl" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            φ
          </span>
          {title}
        </h3>
      )}
      
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={coloredData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={CustomLabel}
            outerRadius={outerRadius}
            innerRadius={innerRadius}
            fill="#8884d8"
            dataKey="value"
            animationBegin={0}
            animationDuration={animated ? 800 : 0}
          >
            {coloredData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color}
                className="hover:opacity-80 transition-opacity cursor-pointer"
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          {showLegend && (
            <Legend 
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              wrapperStyle={{
                paddingTop: '20px',
                fontSize: '14px'
              }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>

      {/* Total Display */}
      <div className="text-center mt-4 pt-4 border-t border-phi-frost">
        <p className="text-sm text-phi-slate">סה"כ</p>
        <p className="text-2xl font-bold text-phi-dark">
          ₪{total.toLocaleString()}
        </p>
      </div>
    </motion.div>
  )
}

