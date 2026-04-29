import { TopicList } from '../topics/TopicList'

export function Sidebar(): JSX.Element {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r bg-gray-50">
      <div className="h-8 shrink-0" /> {/* macOS traffic light spacer */}
      <TopicList />
    </aside>
  )
}
