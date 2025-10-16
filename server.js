const express = require('express')
const bcrypt = require('bcrypt-node')
const cors = require('cors')
const knex = require('knex')
const port = process.env.PORT || 3057;

const app = express()


app.use(cors())
app.use(express.json())


const pg = knex({
    client: 'pg',
    connection: {
    connectionString: process.env.DATABASE_URL,
    ssl:{ rejectUnauthorized: false}
}
});


//Audiophile server
app.get('/', (req, res) => {
    pg.select('*').from('products')
    .then(user => {
        if (user.length) {
            res.json(user)
        } else {
            res.status(400).json('Not found')
        }}
    )

})


app.post('/login', (req, res) => {
    const { email, password } = req.body
        pg.select('email', 'hash').from('login')
        .where('email', '=', email)
        .then(data => {
            const isValid = bcrypt.compareSync(password, data[0].hash)
            if (isValid) {
                pg.select('*').from('users')
                .where('email', '=', email)
                .then(user => {
                    
                    res.json(user[0])

                })
                .catch(err => res.status(400).json('user cannot be found'))
            } else {
                res.status(400).json('wrong credentials')
            }
        })
        .catch(err => {
            res.status(400).json('incorrect password or username')
        })
})



app.post('/register', (req, res) => {
    const { email, name, password} = req.body
    const hash = bcrypt.hashSync(password);
    pg.transaction(trx => {
        trx.insert({
            hash: hash,
            email: email
        })
        .into('login')
        .returning('email')
        .then(loginEmail => {
            return trx('users')
            .returning('*')
            .insert({ 
                email: loginEmail[0].email,
                name: name,
                joined: new Date()
            })
            .then(user => res.json(user[0]))
        })
        .then(trx.commit)
        .catch(trx.rollback)
    })    
    .catch(err => res.status(400).json('Unable to register'))
})

app.get('/profile/:id', (req, res) => {
    const {id} = req.params
    pg.select('*').from('users').where({id})
    .then(user => {
        if (user.length) {
            res.json(user[0])
        } else {
            res.status(400).json('Not found')
        }}
    )
    .catch(error => res.status(400).json('Error performing operation'))
    }
)



app.post('/carted', (req, res) => {
    const { id } = req.body
        pg.select( 'products.name as name',
        'products.price', pg.raw("products.image ->> 'desktop' AS image"),
        'quantity', pg.raw('products.price * quantity as cost'))
        .from('carted_items')
        .join('users', 'carted_items.user_id', '=' , 'users.id')
        .join('products', 'carted_items.product_id', '=' , 'products.id')
        .where('user_id', '=', id)
        .then(data => {
            res.json(data)
        })
        .catch(err => res.status(400).json('error performing operation'))
})



app.post('/cart', (req, res) => {
    const { user_id, product_id, quantity } = req.body
    pg('carted_items')
    .where({user_id, product_id})
    .first()
    .then(existing => {
    if(existing){
        
        pg('carted_items')
        .where({user_id, product_id})
        .update({quantity: Number(quantity)})
        .then(console.log)
        pg.select( 'products.name as name',
        'products.price', pg.raw("products.image ->> 'desktop' AS image"),
        'quantity', pg.raw('products.price * quantity as cost'))
        .from('carted_items')
        .join('users', 'carted_items.user_id', '=' , 'users.id')
        .join('products', 'carted_items.product_id', '=' , 'products.id')
        .where('user_id', '=', user_id)
        .then(data => {res.json(data)})
        .catch(err => res.status(400).json('error performing operation'))
            
        } else {
    pg('carted_items')
        .insert({ 
                user_id: user_id,
                product_id: product_id,
                quantity: quantity
            })
        .returning('*')
        .then(() => {
            pg.select( 'products.name as name',
        'products.price', pg.raw("products.image ->> 'desktop' AS image"),
        'quantity', pg.raw('products.price * quantity as cost'))
        .from('carted_items')
        .join('users', 'carted_items.user_id', '=' , 'users.id')
        .join('products', 'carted_items.product_id', '=' , 'products.id')
        .where('user_id', '=', user_id)
        .then(data => {
            res.json(data)
        })
        .catch(err => res.status(400).json('error performing operation'))

    })
        }
    })
})



app.delete('/cartdelete', (req, res) => {
    const { user_id } = req.body
    pg('carted_items')
    .where({ user_id })
    .del()
    .then(res => console.log('deleted rows', res))
    .catch(err => res.json(err))
})


app.listen(port, () => {
    console.log('running port 3000')
})
