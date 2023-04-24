const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("../test/task1-repo/data/data.db");
const { graphqlHTTP } = require("express-graphql");
const express = require("express");
const {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLList,
  GraphQLInt,
  GraphQLNonNull,
} = require("graphql");

const app = express();

const authors = [
  { id: 1, name: "J. K. Rowling" },
  { id: 2, name: "J. R. R. Tolkien" },
  { id: 3, name: "Brent Weeks" },
];

const books = [
  { id: 1, name: "Harry Potter and the Chamber of Secrets", authorId: 1 },
  { id: 2, name: "Harry Potter and the Prisoner of Azkaban", authorId: 1 },
  { id: 3, name: "Harry Potter and the Goblet of Fire", authorId: 1 },
  { id: 4, name: "The Fellowship of the Ring", authorId: 2 },
  { id: 5, name: "The Two Towers", authorId: 2 },
  { id: 6, name: "The Return of the King", authorId: 2 },
  { id: 7, name: "The Way of Shadows", authorId: 3 },
  { id: 8, name: "Beyond the Shadows", authorId: 3 },
];

const BookType = new GraphQLObjectType({
  name: "Book",
  description: "This represents a book written by an author",
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLInt) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    authorId: { type: new GraphQLNonNull(GraphQLInt) },
    author: {
      type: AuthorType,
      resolve: (book) => {
        return authors.find((author) => author.id === book.authorId);
      },
    },
  }),
});

const AuthorType = new GraphQLObjectType({
  name: "Author",
  description: "This represents a author of a book",
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLInt) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    books: {
      type: new GraphQLList(BookType),
      resolve: (author) => {
        return books.filter((book) => book.authorId === author.id);
      },
    },
  }),
});

const SongType = new GraphQLObjectType({
  name: "Song",
  description: "This represents a song",
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLInt) },
    title: { type: new GraphQLNonNull(GraphQLString) },
    releaseYear: { type: new GraphQLNonNull(GraphQLInt) },
    artist: { type: new GraphQLNonNull(GraphQLString) },
  }),
});

const RootQueryType = new GraphQLObjectType({
  name: "Query",
  description: "Root Query",
  fields: () => ({
    book: {
      type: BookType,
      description: "A Single Book",
      args: {
        id: { type: GraphQLInt },
      },
      resolve: (parent, args) => books.find((book) => book.id === args.id),
    },
    books: {
      type: new GraphQLList(BookType),
      description: "List of All Books",
      resolve: () => books,
    },
    authors: {
      type: new GraphQLList(AuthorType),
      description: "List of All Authors",
      resolve: () => authors,
    },
    author: {
      type: AuthorType,
      description: "A Single Author",
      args: {
        id: { type: GraphQLInt },
      },
      resolve: (parent, args) =>
        authors.find((author) => author.id === args.id),
    },
    songs: {
      type: new GraphQLList(SongType),
      resolve: (parent, args) => {
        return new Promise((resolve, reject) => {
          db.all("SELECT * FROM songs", (error, rows) => {
            if (error) {
              reject(error);
            } else {
              resolve(rows);
            }
          });
        });
      },
    },
    song: {
      type: SongType,
      description: "A Single Song",
      args: {
        id: { type: GraphQLInt },
      },
      resolve: (parent, args) => {
        return new Promise((resolve, reject) => {
          db.get(
            "SELECT * FROM songs WHERE id = ?",
            [args.id],
            (error, row) => {
              if (error) {
                reject(error);
              } else {
                resolve(row);
              }
            }
          );
        });
      },
    },
  }),
});

const RootMutationType = new GraphQLObjectType({
  name: "Mutation",
  description: "Root Mutation",
  fields: () => ({
    addBook: {
      type: BookType,
      description: "Add a book",
      args: {
        name: { type: new GraphQLNonNull(GraphQLString) },
        authorId: { type: new GraphQLNonNull(GraphQLInt) },
      },
      resolve: (parent, args) => {
        const book = {
          id: books.length + 1,
          name: args.name,
          authorId: args.authorId,
        };
        books.push(book);
        return book;
      },
    },
    addAuthor: {
      type: AuthorType,
      description: "Add an author",
      args: {
        name: { type: new GraphQLNonNull(GraphQLString) },
      },
      resolve: (parent, args) => {
        const author = { id: authors.length + 1, name: args.name };
        authors.push(author);
        return author;
      },
    },
    addSong: {
      type: SongType,
      description: "Add a new song",
      args: {
        title: { type: new GraphQLNonNull(GraphQLString) },
        artist: { type: new GraphQLNonNull(GraphQLString) },
        releaseYear: { type: new GraphQLNonNull(GraphQLInt) },
      },
      resolve: (parent, args) => {
        return new Promise((resolve, reject) => {
          const { title, artist, releaseYear } = args;
          db.run(
            "INSERT INTO songs (title, artist, releaseYear) VALUES (?, ?, ?)",
            [title, artist, releaseYear],
            function (error) {
              if (error) {
                reject(error);
              } else {
                db.get(
                  "SELECT * FROM songs WHERE id = ?",
                  [this.lastID],
                  (error, row) => {
                    if (error) {
                      reject(error);
                    } else {
                      resolve(row);
                    }
                  }
                );
              }
            }
          );
        });
      },
    },
    updateSong: {
      type: SongType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLInt) },
        title: { type: GraphQLString },
        artist: { type: GraphQLString },
        releaseYear: { type: GraphQLInt },
      },
      resolve: (parent, args) => {
        return new Promise((resolve, reject) => {
          let updateClause = "";
          let updateParams = [];
          if (args.title) {
            updateClause += "title = ?, ";
            updateParams.push(args.title);
          }
          if (args.artist) {
            updateClause += "artist = ?, ";
            updateParams.push(args.artist);
          }
          if (args.releaseYear) {
            updateClause += "releaseYear = ?, ";
            updateParams.push(args.releaseYear);
          }
          updateClause = updateClause.slice(0, -2);
          db.run(
            `UPDATE songs SET ${updateClause} WHERE id = ?`,
            [...updateParams, args.id],
            (error) => {
              if (error) {
                reject(error);
              } else {
                db.get(
                  "SELECT * FROM songs WHERE id = ?",
                  [args.id],
                  (error, row) => {
                    if (error) {
                      reject(error);
                    } else {
                      resolve(row);
                    }
                  }
                );
              }
            }
          );
        });
      },
    },
    deleteSong: {
      type: GraphQLString,
      args: {
        id: { type: new GraphQLNonNull(GraphQLInt) },
      },
      resolve: (parent, args) => {
        return new Promise((resolve, reject) => {
          db.run("DELETE FROM songs WHERE id = ?", [args.id], (error) => {
            if (error) {
              reject(error);
            } else {
              resolve(`Song with ID ${args.id} has been deleted`);
            }
          });
        });
      },
    },
  }),
});

const schema = new GraphQLSchema({
  query: RootQueryType,
  mutation: RootMutationType,
});

app.use(
  "/graphql",
  graphqlHTTP({
    schema: schema,
    graphiql: true,
  })
);
app.listen(5000, () => console.log("Server is listening on port 5000"));
