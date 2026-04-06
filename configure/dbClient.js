const { Pool } = require("pg");
const { URL } = require("url");

const connectionString = process.env.DATABASE_URL;
const poolConfig = {};

if (connectionString) {
  const dbUrl = new URL(connectionString);
  poolConfig.host = dbUrl.hostname;
  poolConfig.port = dbUrl.port ? Number(dbUrl.port) : undefined;
  poolConfig.user = dbUrl.username ? decodeURIComponent(dbUrl.username) : undefined;
  poolConfig.password = dbUrl.password ? decodeURIComponent(dbUrl.password) : undefined;
  poolConfig.database = dbUrl.pathname ? dbUrl.pathname.slice(1) : undefined;

  if (dbUrl.searchParams.has("sslmode")) {
    const sslmode = dbUrl.searchParams.get("sslmode");
    if (sslmode === "disable") {
      poolConfig.ssl = false;
    } else {
      poolConfig.ssl = { rejectUnauthorized: false };
    }
  } else if (process.env.NODE_ENV === "production") {
    poolConfig.ssl = { rejectUnauthorized: false };
  }
} else {
  poolConfig.connectionString = connectionString;
}

const pool = new Pool(poolConfig);
const query = async (text, params) => {
  try {
    return await pool.query(text, params);
  } catch (error) {
    console.error("Database Query Error:", {
      message: error.message,
      sql: text,
      params: params?.map(p => typeof p === 'string' && p.length > 50 ? p.slice(0, 50) + '...' : p)
    });
    throw error;
  }
};

const modelTableMap = {
  user: "\"User\"",
  product: "\"Product\"",
  store: "\"Store\"",
  productcolor: "\"ProductColor\"",
  color: "\"Color\"",
  review: "\"Review\"",
  order: "\"Order\"",
  orderitem: "\"OrderItem\"",
  cart: "\"Cart\"",
  category: "\"Category\"",
  subcategory: "\"Subcategory\"",
  brand: "\"Brand\"",
  tag: "\"Tag\"",
  size: "\"Size\"",
  activity: "\"Activity\"",
  blog: "\"Blog\"",
  blogcategory: "\"BlogCategory\"",
  blogsubcategory: "\"BlogSubCategory\"",
  conversation: "\"Conversation\"",
  message: "\"Message\"",
  notification: "\"Notification\"",
  coupon: "\"Coupon\"",
  fqa: "\"FQA\"",
  deliveryassignment: "\"DeliveryAssignment\"",
  package: "\"Package\"",
  healthadvice: "\"HealthAdvice\"",
  promotion: "\"Promotion\"",
  report: "\"Report\"",
  adhome: "\"AdHome\"",
  specialad: "\"SpecialAd\"",
  bannerad: "\"BannerAd\"",
};

const relationConfig = {
  product: {
    store: { type: "manyToOne", target: "Store", fk: "storeId" },
    postedBy: { type: "manyToOne", target: "User", fk: "postedByUserId" },
    reviews: { type: "oneToMany", target: "Review", fk: "productId" },
    colors: { type: "oneToMany", target: "ProductColor", fk: "productId" },
    orderItems: { type: "oneToMany", target: "OrderItem", fk: "productId" },
    carts: { type: "oneToMany", target: "Cart", fk: "productId" },
    wishlistedBy: {
      type: "manyToMany",
      target: "Product",
      join: { table: "\"_Wishlist\"", selfKey: "A", targetKey: "B" }
    }
  },
  user: {
    products: { type: "oneToMany", target: "Product", fk: "postedByUserId" },
    orders: { type: "oneToMany", target: "Order", fk: "userId" },
    assignedOrders: { type: "oneToMany", target: "Order", fk: "assignedToId" },
    reviews: { type: "oneToMany", target: "Review", fk: "userId" },
    notifications: { type: "oneToMany", target: "Notification", fk: "userId" },
    activities: { type: "oneToMany", target: "Activity", fk: "userId" },
    chatMessages: { type: "oneToMany", target: "Message", fk: "senderId" },
    stores: { type: "oneToMany", target: "Store", fk: "ownerId" },
    carts: { type: "oneToMany", target: "Cart", fk: "userId" },
    deliveryAssignments: { type: "oneToMany", target: "DeliveryAssignment", fk: "userId" },
    reports: { type: "oneToMany", target: "Report", fk: "userId" },
    wishlist: {
      type: "manyToMany",
      target: "Product",
      join: { table: "\"_Wishlist\"", selfKey: "B", targetKey: "A" }
    }
  },
  productcolor: {
    product: { type: "manyToOne", target: "Product", fk: "productId" },
    color: { type: "manyToOne", target: "Color", fk: "colorId" }
  },
  review: {
    product: { type: "manyToOne", target: "Product", fk: "productId" },
    user: { type: "manyToOne", target: "User", fk: "userId" }
  },
  order: {
    user: { type: "manyToOne", target: "User", fk: "userId" },
    assignedTo: { type: "manyToOne", target: "User", fk: "assignedToId" },
    items: { type: "oneToMany", target: "OrderItem", fk: "orderId" }
  },
  orderitem: {
    order: { type: "manyToOne", target: "Order", fk: "orderId" },
    product: { type: "manyToOne", target: "Product", fk: "productId" }
  },
  cart: {
    user: { type: "manyToOne", target: "User", fk: "userId" },
    product: { type: "manyToOne", target: "Product", fk: "productId" }
  },
  activity: { user: { type: "manyToOne", target: "User", fk: "userId" } },
  message: {
    sender: { type: "manyToOne", target: "User", fk: "senderId" },
    conversation: { type: "manyToOne", target: "Conversation", fk: "conversationId" }
  },
  conversation: {
    users: { type: "manyToMany", target: "User", join: { table: "\"_UserConversations\"", selfKey: "A", targetKey: "B" } },
    messages: { type: "oneToMany", target: "Message", fk: "conversationId" }
  },
  notification: { user: { type: "manyToOne", target: "User", fk: "userId" } },
  report: { user: { type: "manyToOne", target: "User", fk: "userId" } },
  store: { owner: { type: "manyToOne", target: "User", fk: "ownerId" } },
  deliveryassignment: {
    user: { type: "manyToOne", target: "User", fk: "userId" },
    order: { type: "manyToOne", target: "Order", fk: "orderId" }
  }
};

const quoteIdentifier = (identifier) => `\"${identifier.replace(/\"/g, "\\\"")}\"`;
const getTableName = (modelName) => modelTableMap[modelName.toLowerCase()] || quoteIdentifier(modelName);

const buildWhere = (modelName, where, params = [], prefix) => {
  if (!where || Object.keys(where).length === 0) return { clause: "", params };

  const clauses = [];
  const relations = relationConfig[modelName] || {};
  const prefixClause = prefix ? `${prefix}.` : "";
  const quoteColumn = (column) => `${prefixClause}${quoteIdentifier(column)}`;

  for (const [key, value] of Object.entries(where)) {
    // Skip undefined values to avoid 'supplies X requires Y' mismatches
    if (value === undefined) continue;

    if (key === "AND" || key === "OR") {
      if (!Array.isArray(value) || !value.length) continue;
      const nestedClauses = [];
      for (const item of value) {
        const nested = buildWhere(modelName, item, params, prefix);
        if (nested.clause) nestedClauses.push(`(${nested.clause})`);
      }
      if (nestedClauses.length) clauses.push(`(${nestedClauses.join(` ${key} `)})`);
      continue;
    }

    if (value === null) {
      clauses.push(`${quoteColumn(key)} IS NULL`);
      continue;
    }

    if (typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      const relation = relations[key];
      if (relation && relation.type === "manyToMany" && value.some) {
        const targetTable = getTableName(relation.target.toLowerCase());
        const joinTable = relation.join.table;
        const selfKey = relation.join.selfKey;
        const targetKey = relation.join.targetKey;
        const nested = buildWhere(relation.target.toLowerCase(), value.some, params, "tt");
        const existsClause = `EXISTS (SELECT 1 FROM ${joinTable} jt JOIN ${targetTable} tt ON tt.${quoteIdentifier("id")} = jt.${quoteIdentifier(targetKey)} WHERE jt.${quoteIdentifier(selfKey)} = ${quoteColumn("id")} AND ${nested.clause})`;
        clauses.push(existsClause);
        continue;
      }

      // JSONB path/equals e.g. { path: ['Isread'], equals: false }
      if (Array.isArray(value.path) && value.path.length > 0 && "equals" in value) {
        const pathArr = value.path.map((p) => `'${p}'`).join(",");
        clauses.push(`(${quoteColumn(key)} #>> ARRAY[${pathArr}])::text = $${params.length + 1}`);
        params.push(String(value.equals));
        continue;
      }

      for (const [op, val] of Object.entries(value)) {
        if (val === undefined) continue;
        switch (op) {
          case "gte":
            clauses.push(`${quoteColumn(key)} >= $${params.length + 1}`);
            params.push(val);
            break;
          case "lte":
            clauses.push(`${quoteColumn(key)} <= $${params.length + 1}`);
            params.push(val);
            break;
          case "gt":
            clauses.push(`${quoteColumn(key)} > $${params.length + 1}`);
            params.push(val);
            break;
          case "lt":
            clauses.push(`${quoteColumn(key)} < $${params.length + 1}`);
            params.push(val);
            break;
          case "contains":
            clauses.push(`${quoteColumn(key)} ILIKE $${params.length + 1}`);
            params.push(`%${val}%`);
            break;
          case "in":
            if (Array.isArray(val) && val.length > 0) {
              const placeholders = val.map((_, idx) => `$${params.length + idx + 1}`).join(", ");
              clauses.push(`${quoteColumn(key)} IN (${placeholders})`);
              params.push(...val);
            } else {
              clauses.push("FALSE");
            }
            break;
          default:
            // Support simple equality if it's an operator we don't recognize or just a key
            clauses.push(`${quoteColumn(key)} = $${params.length + 1}`);
            params.push(val);
            break;
        }
      }
      continue;
    }

    clauses.push(`${quoteColumn(key)} = $${params.length + 1}`);
    params.push(value);
  }

  return { clause: clauses.length ? clauses.join(" AND ") : "", params };
};

const buildOrderBy = (orderBy) => {
  if (!orderBy) return "";
  const clauses = [];
  if (Array.isArray(orderBy)) {
    orderBy.forEach((item) => {
      const [key, direction] = Object.entries(item)[0];
      clauses.push(`${quoteIdentifier(key)} ${String(direction).toUpperCase()}`);
    });
  } else {
    Object.entries(orderBy).forEach(([key, direction]) => {
      clauses.push(`${quoteIdentifier(key)} ${String(direction).toUpperCase()}`);
    });
  }
  return clauses.length ? ` ORDER BY ${clauses.join(", ")}` : "";
};

const loadIncludes = async (rows, modelName, include) => {
  if (!include || !rows?.length) return rows;
  const modelRelations = relationConfig[modelName] || {};

  const tasks = Object.entries(include).map(async ([relationKey, relationValue]) => {
    const relation = modelRelations[relationKey];
    if (!relation) return;

    if (relation.type === "manyToOne") {
      const targetTable = getTableName(relation.target.toLowerCase());
      const foreignKey = relation.fk;
      const ids = [...new Set(rows.map((row) => row[foreignKey]).filter(Boolean))];
      if (ids.length === 0) return;
      const placeholders = ids.map((_, idx) => `$${idx + 1}`).join(", ");
      const result = await query(`SELECT * FROM ${targetTable} WHERE ${quoteIdentifier("id")} IN (${placeholders})`, ids);
      const lookup = result.rows.reduce((acc, item) => ({ ...acc, [item.id]: item }), {});
      rows.forEach((row) => {
        row[relationKey] = lookup[row[foreignKey]] || null;
      });
      if (relationValue && typeof relationValue === "object" && relationValue.include) {
        const nestedRows = rows.map((row) => row[relationKey]).filter(Boolean);
        await loadIncludes(nestedRows, relation.target.toLowerCase(), relationValue.include);
      }
    }

    if (relation.type === "oneToMany") {
      const targetTable = getTableName(relation.target.toLowerCase());
      const foreignKey = relation.fk;
      const ids = rows.map((row) => row.id).filter(Boolean);
      if (ids.length === 0) return;
      const whereClause = { ...(relationValue && typeof relationValue === "object" && relationValue.where ? relationValue.where : {}), [foreignKey]: { in: ids } };
      const params = [];
      const conditions = buildWhere(relation.target.toLowerCase(), whereClause, params);
      let sql = `SELECT * FROM ${targetTable}`;
      if (conditions.clause) sql += ` WHERE ${conditions.clause}`;
      if (relationValue && typeof relationValue === "object") {
        sql += buildOrderBy(relationValue.orderBy);
        if (relationValue.skip) sql += ` OFFSET ${Number(relationValue.skip)}`;
        if (relationValue.take) sql += ` LIMIT ${Number(relationValue.take)}`;
      }
      const result = await query(sql, params);
      const grouped = result.rows.reduce((acc, item) => {
        const key = item[foreignKey];
        acc[key] = acc[key] || [];
        acc[key].push(item);
        return acc;
      }, {});
      rows.forEach((row) => {
        row[relationKey] = grouped[row.id] || [];
      });
      if (relationValue && typeof relationValue === "object" && relationValue.include) {
        const nestedRows = result.rows;
        await loadIncludes(nestedRows, relation.target.toLowerCase(), relationValue.include);
      }
    }

    if (relation.type === "manyToMany") {
      const joinTable = relation.join.table;
      const selfKey = relation.join.selfKey;
      const targetKey = relation.join.targetKey;
      const targetTable = getTableName(relation.target.toLowerCase());
      const ids = rows.map((row) => row.id).filter(Boolean);
      if (ids.length === 0) return;
      const placeholders = ids.map((_, idx) => `$${idx + 1}`).join(", ");
      const joinRes = await query(
        `SELECT * FROM ${joinTable} WHERE ${quoteIdentifier(selfKey)} IN (${placeholders})`,
        ids
      );
      const targetIds = [...new Set(joinRes.rows.map((item) => item[targetKey]))];
      if (!targetIds.length) {
        rows.forEach((row) => {
          row[relationKey] = [];
        });
        return;
      }
      const targetPlaceholders = targetIds.map((_, idx) => `$${idx + 1}`).join(", ");
      const targetRes = await query(`SELECT * FROM ${targetTable} WHERE ${quoteIdentifier("id")} IN (${targetPlaceholders})`, targetIds);
      const targetLookup = targetRes.rows.reduce((acc, item) => ({ ...acc, [item.id]: item }), {});
      const grouped = joinRes.rows.reduce((acc, item) => {
        const selfId = item[selfKey];
        acc[selfId] = acc[selfId] || [];
        if (targetLookup[item[targetKey]]) acc[selfId].push(targetLookup[item[targetKey]]);
        return acc;
      }, {});
      rows.forEach((row) => {
        row[relationKey] = grouped[row.id] || [];
      });
      if (relationValue && typeof relationValue === "object" && relationValue.include) {
        const nestedRows = joinRes.rows.flatMap((item) => grouped[item[selfKey]] || []);
        await loadIncludes(nestedRows, relation.target.toLowerCase(), relationValue.include);
      }
    }
  });

  await Promise.all(tasks);
  return rows;
};

const getModel = (modelName) => {
  const modelKey = modelName.toLowerCase();
  const tableName = getTableName(modelKey);
  const relations = relationConfig[modelKey] || {};

  const toColumns = (data) => Object.entries(data).reduce((acc, [key, value]) => {
    if (value === undefined) return acc;
    if (value === null) {
      acc[key] = null;
      return acc;
    }
    if (typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      if (value.connect || value.create || value.disconnect || value.set) {
        return acc;
      }
      acc[key] = value;
      return acc;
    }
    acc[key] = value;
    return acc;
  }, {});

  const flattenData = (data) => {
    const columns = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === "id" && (value === null || value === undefined)) {
        continue;
      }
      if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
        if (value.connect) {
          const relation = relations[key];
          if (relation && relation.fk && value.connect.id) {
            columns[relation.fk] = value.connect.id;
          }
          continue;
        }
        if (value.disconnect || value.set) {
          continue;
        }
      }
      columns[key] = value;
    }
    return columns;
  };

  const buildInsert = (data) => {
    const columns = flattenData(data);
    const keys = Object.keys(columns);
    const params = Object.values(columns);
    const columnsSql = keys.map((key) => quoteIdentifier(key)).join(", ");
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(", ");
    return { sql: `INSERT INTO ${tableName} (${columnsSql}) VALUES (${placeholders}) RETURNING *`, params };
  };

  const applyNestedOperations = async (recordId, data, isCreate = false) => {
    const nestedFields = Object.entries(data).filter(([, value]) => value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date) && (value.connect || value.create || value.disconnect || value.set));

    for (const [field, operations] of nestedFields) {
      const relation = relations[field];
      if (!relation) continue;

      if (relation.type === "oneToMany" && operations.create) {
        const items = Array.isArray(operations.create) ? operations.create : [operations.create];
        for (const item of items) {
          if (!item) continue;
          const itemData = { ...item, [relation.fk]: recordId };
          const targetTable = getTableName(relation.target.toLowerCase());
          const flat = flattenData(itemData);
          const keys = Object.keys(flat);
          if (!keys.length) continue;
          const params = Object.values(flat);
          const columnsSql = keys.map((key) => quoteIdentifier(key)).join(", ");
          const placeholders = keys.map((_, index) => `$${index + 1}`).join(", ");
          await query(`INSERT INTO ${targetTable} (${columnsSql}) VALUES (${placeholders})`, params);
        }
      }

      if (relation.type === "manyToMany") {
        const joinTable = relation.join.table;
        const connectItems = operations.connect ? (Array.isArray(operations.connect) ? operations.connect : [operations.connect]) : [];
        for (const connectItem of connectItems) {
          if (connectItem && connectItem.id) {
            await query(
              `INSERT INTO ${joinTable} (${quoteIdentifier(relation.join.selfKey)}, ${quoteIdentifier(relation.join.targetKey)}) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [recordId, connectItem.id]
            );
          }
        }
        const disconnectItems = operations.disconnect ? (Array.isArray(operations.disconnect) ? operations.disconnect : [operations.disconnect]) : [];
        for (const disconnectItem of disconnectItems) {
          if (disconnectItem && disconnectItem.id) {
            await query(
              `DELETE FROM ${joinTable} WHERE ${quoteIdentifier(relation.join.selfKey)} = $1 AND ${quoteIdentifier(relation.join.targetKey)} = $2`,
              [recordId, disconnectItem.id]
            );
          }
        }
        if (operations.set && Array.isArray(operations.set)) {
          await query(`DELETE FROM ${joinTable} WHERE ${quoteIdentifier(relation.join.selfKey)} = $1`, [recordId]);
          for (const connectItem of operations.set) {
            if (connectItem && connectItem.id) {
              await query(
                `INSERT INTO ${joinTable} (${quoteIdentifier(relation.join.selfKey)}, ${quoteIdentifier(relation.join.targetKey)}) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [recordId, connectItem.id]
              );
            }
          }
        }
      }
    }
  };

  const create = async ({ data, include } = {}) => {
    const insertData = flattenData(data);
    const result = await query(buildInsert(insertData).sql, buildInsert(insertData).params);
    const row = result.rows[0];
    await applyNestedOperations(row.id, data, true);
    if (include) {
      const rows = await loadIncludes([row], modelName, include);
      return rows[0];
    }
    return row;
  };

  const update = async ({ where, data, include } = {}) => {
    const updateData = flattenData(data);
    const updateKeys = Object.keys(updateData);
    const updateParams = Object.values(updateData);

    const { clause, params: finalParams } = buildWhere(modelName, where, [...updateParams]);

    if (!updateKeys.length) {
      await applyNestedOperations(where?.id || where?._id, data, false);
      const { clause: selectClause, params: selectParams } = buildWhere(modelName, where, []);
      const row = await query(`SELECT * FROM ${tableName} WHERE ${selectClause}`, selectParams);
      return row.rows[0];
    }

    const setClauses = updateKeys.map((key, index) => `${quoteIdentifier(key)} = $${index + 1}`);
    const sql = `UPDATE ${tableName} SET ${setClauses.join(", ")}${clause ? ` WHERE ${clause}` : ""} RETURNING *`;
    const result = await query(sql, finalParams);
    const row = result.rows[0];

    if (row?.id) {
       await applyNestedOperations(row.id, data, false);
    }

    if (include && row) {
      const rows = await loadIncludes([row], modelName, include);
      return rows[0];
    }
    return row;
  };

  const deleteOne = async ({ where } = {}) => {
    const { clause, params } = buildWhere(modelName, where, []);
    const result = await query(`DELETE FROM ${tableName} WHERE ${clause} RETURNING *`, params);
    return result.rows[0] || { count: result.rowCount };
  };

  const deleteMany = async ({ where } = {}) => {
    const { clause, params } = buildWhere(modelName, where, []);
    const sql = clause ? `DELETE FROM ${tableName} WHERE ${clause}` : `DELETE FROM ${tableName}`;
    const result = await query(sql, params);
    return { count: result.rowCount };
  };

  const findMany = async ({ where, include, orderBy, take, skip } = {}) => {
    const params = [];
    const conditions = buildWhere(modelName, where, params);
    const sql = [`SELECT * FROM ${tableName}`];
    if (conditions.clause) sql.push(`WHERE ${conditions.clause}`);
    if (orderBy) sql.push(buildOrderBy(orderBy));
    if (skip) sql.push(`OFFSET ${Number(skip)}`);
    if (take) sql.push(`LIMIT ${Number(take)}`);
    const result = await query(sql.join(" "), conditions.params);
    const rows = result.rows;
    if (include) {
      await loadIncludes(rows, modelName, include);
    }
    return rows;
  };

  const findUnique = async ({ where, include } = {}) => {
    const rows = await findMany({ where, include, take: 1 });
    return rows[0] || null;
  };

  const findFirst = async ({ where, include, orderBy } = {}) => {
    const rows = await findMany({ where, include, orderBy, take: 1 });
    return rows[0] || null;
  };

  const updateMany = async ({ where, data } = {}) => {
    const updateData = flattenData(data);
    const keys = Object.keys(updateData);
    if (!keys.length) return { count: 0 };
    
    // Pass existing update values as initial params to shift WHERE placeholders
    const updateValues = Object.values(updateData);
    const { clause, params: finalParams } = buildWhere(modelName, where, [...updateValues]);
    
    const setClauses = keys.map((key, index) => `${quoteIdentifier(key)} = $${index + 1}`);
    const sql = `UPDATE ${tableName} SET ${setClauses.join(", ")}${clause ? ` WHERE ${clause}` : ""}`;
    const result = await query(sql, finalParams);
    return { count: result.rowCount };
  };

  const count = async ({ where } = {}) => {
    const { clause, params } = buildWhere(modelName, where, []);
    const sql = `SELECT COUNT(*)::int AS count FROM ${tableName} ${clause ? `WHERE ${clause}` : ""}`;
    const result = await query(sql, params);
    return result.rows[0].count;
  };

  const groupBy = async ({ by, where, _count, _sum } = {}) => {
    const selected = [];
    const table = tableName;
    const _countFields = _count ? Object.keys(_count) : [];
    const _sumFields = _sum ? Object.keys(_sum) : [];

    by.forEach((field) => selected.push(quoteIdentifier(field)));
    _countFields.forEach((field) => selected.push(`COUNT(${quoteIdentifier(field)}) AS ${quoteIdentifier(`count_${field}`)}`));
    _sumFields.forEach((field) => selected.push(`SUM(${quoteIdentifier(field)}) AS ${quoteIdentifier(`sum_${field}`)}`));

    const params = [];
    const conditions = buildWhere(modelName, where, params);
    const sql = [`SELECT ${selected.join(", ")} FROM ${table}`];
    if (conditions.clause) sql.push(`WHERE ${conditions.clause}`);
    sql.push(`GROUP BY ${by.map((field) => quoteIdentifier(field)).join(", ")}`);
    const result = await query(sql.join(" "), conditions.params);
    return result.rows.map((row) => ({
      ...by.reduce((acc, field) => ({ ...acc, [field]: row[field] }), {}),
      _count: _countFields.reduce((acc, field) => ({ ...acc, [field]: Number(row[`count_${field}`]) || 0 }), {}),
      _sum: _sumFields.reduce((acc, field) => ({ ...acc, [field]: Number(row[`sum_${field}`]) || 0 }), {}),
    }));
  };

  const aggregate = async ({ where, _count, _sum } = {}) => {
    const selected = [];
    const table = tableName;
    const _countFields = _count ? Object.keys(_count) : [];
    const _sumFields = _sum ? Object.keys(_sum) : [];
    _countFields.forEach((field) => selected.push(`COUNT(${quoteIdentifier(field)}) AS ${quoteIdentifier(`count_${field}`)}`));
    _sumFields.forEach((field) => selected.push(`SUM(${quoteIdentifier(field)}) AS ${quoteIdentifier(`sum_${field}`)}`));
    if (!selected.length) selected.push("COUNT(*) AS count");
    const params = [];
    const conditions = buildWhere(modelName, where, params);
    const sql = [`SELECT ${selected.join(", ")} FROM ${table}`];
    if (conditions.clause) sql.push(`WHERE ${conditions.clause}`);
    const result = await query(sql.join(" "), conditions.params);
    const row = result.rows[0] || {};
    return {
      _count: _countFields.reduce((acc, field) => ({ ...acc, [field]: Number(row[`count_${field}`]) || 0 }), {}),
      _sum: _sumFields.reduce((acc, field) => ({ ...acc, [field]: Number(row[`sum_${field}`]) || 0 }), {}),
    };
  };

  return {
    findMany,
    findUnique,
    findFirst,
    create,
    update,
    delete: deleteOne,
    deleteMany,
    updateMany,
    count,
    groupBy,
    aggregate,
  };
};

const dbProxy = new Proxy({ pool, query }, {
  get(target, property) {
    if (property in target) return target[property];
    return getModel(property.toString());
  }
});

module.exports = dbProxy;
