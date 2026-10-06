import BookController from './BookController'
import BookmarkController from './BookmarkController'
import Settings from './Settings'
const Controllers = {
    BookController: Object.assign(BookController, BookController),
BookmarkController: Object.assign(BookmarkController, BookmarkController),
Settings: Object.assign(Settings, Settings),
}

export default Controllers